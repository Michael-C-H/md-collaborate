/**
 * Node 业务服务
 * by AI.Coding
 *
 * 包含文档树 CRUD、移动、软删；以及文档当前内容的读取与保存（HTTP 入口；
 * 协同编辑时由 Hocuspocus 直接写 nodes.current_content，与本服务并存）。
 *
 * 权限说明：
 *   - 创建：在 folder 下创建子节点 → 需 parent 的 WRITE+；在根级创建 → 任意登录用户
 *   - 重命名 / 移动：需当前节点的 WRITE+
 *   - 软删：需当前节点的 MANAGE
 *   - 读 / 列树：按 permissions 表过滤；creator 与 ADMIN 自动放行
 */
import { Injectable } from '@nestjs/common'
import type { CreateNodeDto, NodeTreeVO, NodeVO, TreesResponse } from '@app/shared'
import { AuditService } from '../audit/audit.service'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../common/exceptions/app.exception'
import type { NodeRow } from '../database/schema'
import { PermissionService } from '../permission/permission.service'
import { PermissionRepo } from '../permission/permission.repo'
import { NodeRepo } from './node.repo'
import { NodePathHelper } from './path-helper'

/** 文档树最大深度（spec：≤ 5） */
const MAX_DEPTH = 5

@Injectable()
export class NodeService {
  constructor(
    private readonly repo: NodeRepo,
    private readonly pathHelper: NodePathHelper,
    private readonly permissionService: PermissionService,
    private readonly permissionRepo: PermissionRepo,
    private readonly audit: AuditService,
  ) {}

  /**
   * 加载当前用户可见的节点树。
   *   - ADMIN：全部 active 节点
   *   - 其他：creator === self ∪ 在 permissions 表中有任意角色的节点 ∪ 这些节点的所有祖先
   */
  async loadTree(currentUserId: number, isAdmin: boolean): Promise<NodeTreeVO[]> {
    const all = await this.repo.listAllActive()

    let visibleIds: Set<number>
    if (isAdmin) {
      visibleIds = new Set(all.map((n) => n.id))
    } else {
      const permittedIds = await this.permissionRepo.listNodeIdsByUser(currentUserId)
      visibleIds = new Set(permittedIds)
      for (const n of all) {
        if (n.creatorId === currentUserId) visibleIds.add(n.id)
      }
      // 把祖先也加入可见集合，避免树形断开
      for (const n of all) {
        if (visibleIds.has(n.id)) {
          for (const seg of n.path.split('/')) {
            if (!seg) continue
            const num = Number(seg)
            if (Number.isFinite(num)) visibleIds.add(num)
          }
        }
      }
    }

    const visible = all.filter((n) => visibleIds.has(n.id))
    return buildTree(visible)
  }

  /**
   * 加载三棵树：我的文档 + 共享给我 + 他人文档（管理员专属）。
   *   - myTree：creatorId === currentUserId 的节点
   *   - sharedTree：有 permissions 记录但 creatorId !== currentUserId 的节点（含祖先路径）
   *   - othersTree：非我创建且无权限的节点（仅管理员，含祖先路径）
   */
  async loadTrees(currentUserId: number, isAdmin: boolean): Promise<TreesResponse> {
    const all = await this.repo.listAllActive()
    const permittedIds = await this.permissionRepo.listNodeIdsByUser(currentUserId)
    const permittedSet = new Set(permittedIds)

    // 我创建的节点
    const myNodeIds = new Set<number>()
    for (const n of all) {
      if (n.creatorId === currentUserId) myNodeIds.add(n.id)
    }

    // 共享节点（有权限但不是我创建的）
    const sharedDirectIds = new Set<number>()
    for (const id of permittedSet) {
      if (!myNodeIds.has(id)) sharedDirectIds.add(id)
    }

    // 为共享节点补全祖先路径
    const sharedAllIds = new Set(sharedDirectIds)
    for (const n of all) {
      if (sharedDirectIds.has(n.id)) {
        for (const seg of n.path.split('/')) {
          if (!seg) continue
          const num = Number(seg)
          if (Number.isFinite(num)) sharedAllIds.add(num)
        }
      }
    }

    // 为我的树补全祖先路径（避免树形断开）
    for (const n of all) {
      if (myNodeIds.has(n.id)) {
        for (const seg of n.path.split('/')) {
          if (!seg) continue
          const num = Number(seg)
          if (Number.isFinite(num)) myNodeIds.add(num)
        }
      }
    }

    // 他人文档（仅管理员）：非我创建且不在共享树中
    const othersAllIds = new Set<number>()
    if (isAdmin) {
      const othersDirectIds = new Set<number>()
      for (const n of all) {
        if (n.creatorId !== currentUserId && !sharedAllIds.has(n.id)) {
          othersDirectIds.add(n.id)
        }
      }
      // 补全祖先路径
      for (const n of all) {
        if (othersDirectIds.has(n.id)) {
          for (const seg of n.path.split('/')) {
            if (!seg) continue
            const num = Number(seg)
            if (Number.isFinite(num)) othersAllIds.add(num)
          }
        }
      }
    }

    const myTree = buildTree(all.filter((n) => myNodeIds.has(n.id)))
    const sharedTree = buildTree(all.filter((n) => sharedAllIds.has(n.id)))
    const othersTree = buildTree(all.filter((n) => othersAllIds.has(n.id)))

    return { myTree, sharedTree, othersTree }
  }

  async findVO(currentUserId: number, isAdmin: boolean, nodeId: number): Promise<NodeVO> {
    const node = await this.repo.findActiveById(nodeId)
    if (!node) throw new NotFoundException('节点不存在')
    // 读权限校验
    const allowed = await this.permissionService.hasMinRole(
      currentUserId,
      isAdmin,
      nodeId,
      'READ',
      node.creatorId,
    )
    if (!allowed) throw new ForbiddenException('没有权限查看该节点')
    return toVO(node)
  }

  /**
   * 创建节点。
   *   - parentId === null：根级，任何登录用户可创建
   *   - parentId !== null：当前用户需对 parent 拥有 WRITE+
   *   - 创建后给当前用户写 MANAGE 权限
   */
  async create(
    currentUserId: number,
    isAdmin: boolean,
    dto: CreateNodeDto,
  ): Promise<NodeVO> {
    let parent: NodeRow | null = null
    let parentPath: string | null = null
    let parentDepth = -1

    if (dto.parentId !== null) {
      parent = await this.repo.findActiveById(dto.parentId)
      if (!parent) throw new NotFoundException('父节点不存在')
      if (parent.type !== 'FOLDER') throw new BadRequestException('只能在文件夹下创建节点')
      const canWrite = await this.permissionService.hasMinRole(
        currentUserId,
        isAdmin,
        parent.id,
        'WRITE',
        parent.creatorId,
      )
      if (!canWrite) throw new ForbiddenException('对该文件夹没有写入权限')
      parentPath = parent.path
      parentDepth = parent.depth
    }

    const targetDepth = parentDepth + 1
    if (targetDepth > MAX_DEPTH) {
      throw new BadRequestException(`层级深度不能超过 ${MAX_DEPTH}`)
    }

    if (await this.repo.existsSiblingByName(dto.parentId, dto.name)) {
      throw new ConflictException('同级已存在同名节点')
    }

    const now = new Date()
    // 先 insert 拿 id，再回写 path
    const id = await this.repo.insertAndReturnId({
      parentId: dto.parentId,
      type: dto.type,
      name: dto.name,
      path: '/_pending', // 占位，下面立刻回写
      depth: targetDepth,
      creatorId: currentUserId,
      createdAt: now,
      updatedAt: now,
    })
    const path = this.pathHelper.buildPath(parentPath, id)
    await this.repo.updatePath(id, path, targetDepth)

    // 给创建者写 MANAGE 权限
    await this.permissionService.grantInitialManage(id, currentUserId)

    const created = await this.repo.findActiveById(id)
    if (!created) throw new Error('创建后查询节点失败')
    this.audit.log({
      userId: currentUserId,
      action: 'NODE_CREATE',
      targetType: 'NODE',
      targetId: id,
      detail: { type: dto.type, name: dto.name, parentId: dto.parentId },
    })
    return toVO(created)
  }

  /** 重命名 + 移动（统一接口，二者可同时变更） */
  async update(
    currentUserId: number,
    isAdmin: boolean,
    nodeId: number,
    patch: { name?: string; parentId?: number | null },
  ): Promise<NodeVO> {
    const node = await this.repo.findActiveById(nodeId)
    if (!node) throw new NotFoundException('节点不存在')

    const canWrite = await this.permissionService.hasMinRole(
      currentUserId,
      isAdmin,
      nodeId,
      'WRITE',
      node.creatorId,
    )
    if (!canWrite) throw new ForbiddenException('没有权限修改该节点')

    // 重命名
    if (patch.name !== undefined && patch.name !== node.name) {
      if (await this.repo.existsSiblingByName(node.parentId, patch.name, nodeId)) {
        throw new ConflictException('同级已存在同名节点')
      }
      await this.repo.updateName(nodeId, patch.name)
    }

    // 移动
    if (patch.parentId !== undefined && patch.parentId !== node.parentId) {
      await this.moveNode(node, patch.parentId, currentUserId, isAdmin)
    }

    const updated = await this.repo.findActiveById(nodeId)
    if (!updated) throw new Error('更新后查询节点失败')
    return toVO(updated)
  }

  /** 抽出来的"移动"步骤，避免 update 方法过长 */
  private async moveNode(
    node: NodeRow,
    newParentId: number | null,
    currentUserId: number,
    isAdmin: boolean,
  ): Promise<void> {
    let newParentPath: string | null = null
    let newParentDepth = -1

    if (newParentId !== null) {
      const newParent = await this.repo.findActiveById(newParentId)
      if (!newParent) throw new NotFoundException('目标父节点不存在')
      if (newParent.type !== 'FOLDER') throw new BadRequestException('目标必须是文件夹')

      // 不能移动到自身或自身子树
      if (this.pathHelper.isUnder(newParent.path, node.path)) {
        throw new BadRequestException('不能移动到自身或自身子树')
      }

      // 目标父节点写权限
      const canWriteParent = await this.permissionService.hasMinRole(
        currentUserId,
        isAdmin,
        newParent.id,
        'WRITE',
        newParent.creatorId,
      )
      if (!canWriteParent) {
        throw new ForbiddenException('对目标文件夹没有写入权限')
      }
      newParentPath = newParent.path
      newParentDepth = newParent.depth
    }

    const newDepthSelf = newParentDepth + 1
    const subtreeMaxDepth = await this.repo.maxDepthOfSubtree(node.path)
    const subtreeMaxOffset = subtreeMaxDepth - node.depth
    if (newDepthSelf + subtreeMaxOffset > MAX_DEPTH) {
      throw new BadRequestException(`移动后层级会超过 ${MAX_DEPTH}`)
    }

    // 目标位置同级唯一性
    if (await this.repo.existsSiblingByName(newParentId, node.name, node.id)) {
      throw new ConflictException('目标位置同级已存在同名节点')
    }

    const newPath = this.pathHelper.buildPath(newParentPath, node.id)
    const depthDelta = newDepthSelf - node.depth
    await this.repo.rewriteSubtreePaths(node.path, newPath, depthDelta)
    await this.repo.updateParent(node.id, newParentId)
  }

  /** 软删整棵子树 */
  async softDelete(currentUserId: number, isAdmin: boolean, nodeId: number): Promise<void> {
    const node = await this.repo.findActiveById(nodeId)
    if (!node) throw new NotFoundException('节点不存在')
    const canManage = await this.permissionService.hasMinRole(
      currentUserId,
      isAdmin,
      nodeId,
      'MANAGE',
      node.creatorId,
    )
    if (!canManage) throw new ForbiddenException('没有权限删除该节点')
    await this.repo.softDeleteSubtree(node.path, currentUserId)
    this.audit.log({
      userId: currentUserId,
      action: 'NODE_SOFT_DELETE',
      targetType: 'NODE',
      targetId: nodeId,
      detail: { name: node.name, type: node.type, path: node.path },
    })
  }

  /** 加载文档当前内容 */
  async loadDocContent(
    currentUserId: number,
    isAdmin: boolean,
    docId: number,
  ): Promise<{ markdown: string | null; updatedAt: string | null }> {
    const node = await this.repo.findActiveById(docId)
    if (!node) throw new NotFoundException('文档不存在')
    if (node.type !== 'DOC') throw new BadRequestException('节点不是文档')

    const allowed = await this.permissionService.hasMinRole(
      currentUserId,
      isAdmin,
      docId,
      'READ',
      node.creatorId,
    )
    if (!allowed) throw new ForbiddenException('没有权限查看该文档')

    return {
      markdown: node.currentContent ?? null,
      updatedAt: node.contentUpdatedAt ? node.contentUpdatedAt.toISOString() : null,
    }
  }
}

// ── 内部工具 ───────────────────────────────────────────────

function toVO(row: NodeRow): NodeVO {
  return {
    id: row.id,
    parentId: row.parentId,
    type: row.type === 'FOLDER' ? 'FOLDER' : 'DOC',
    name: row.name,
    depth: row.depth,
    creatorId: row.creatorId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** 把平铺节点构建为树形结构；排序：FOLDER 优先 + name 字典序 */
function buildTree(rows: NodeRow[]): NodeTreeVO[] {
  const byId = new Map<number, NodeTreeVO>()
  for (const r of rows) {
    byId.set(r.id, { ...toVO(r), children: [] })
  }
  const roots: NodeTreeVO[] = []
  for (const r of rows) {
    const me = byId.get(r.id)
    if (!me) continue
    if (r.parentId === null) {
      roots.push(me)
    } else {
      const parent = byId.get(r.parentId)
      if (parent) parent.children.push(me)
      else roots.push(me) // 父不可见 → 提到根，避免节点丢失
    }
  }
  const sortRec = (list: NodeTreeVO[]): void => {
    list.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'FOLDER' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    for (const n of list) sortRec(n.children)
  }
  sortRec(roots)
  return roots
}
