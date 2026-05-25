/**
 * 回收站业务服务
 * by AI.Coding
 *
 * 三个核心操作：
 *   - list(scope)        列出当前用户视角下的软删根节点
 *   - restore(nodeId)    恢复整棵子树；原父已被删则恢复到根
 *   - purge(nodeId)      整棵子树彻底删除，包含图片引用减计 + 无引用图片物理删
 *
 * 权限：
 *   - mine 视角：当前用户为创建者 / 删除者
 *   - all 视角：仅 ADMIN，可见全部
 *   - restore / purge：ADMIN ∨ 创建者 ∨ 删除者
 */
import { Inject, Injectable } from '@nestjs/common'
import { Logger } from 'nestjs-pino'
import { inArray } from 'drizzle-orm'
import type { TrashItemVO, TrashListQuery } from '@app/shared'
import { AuditService } from '../audit/audit.service'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../common/exceptions/app.exception'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import type { DrizzleClient } from '../database/drizzle.client'
import { images, type NodeRow } from '../database/schema'
import { ImageStorage } from '../image/storage'
import { NodePathHelper } from '../node/path-helper'
import { NodeRepo } from '../node/node.repo'
import { TrashRepo } from './trash.repo'

@Injectable()
export class TrashService {
  constructor(
    private readonly repo: TrashRepo,
    private readonly nodeRepo: NodeRepo,
    private readonly pathHelper: NodePathHelper,
    private readonly imageStorage: ImageStorage,
    private readonly audit: AuditService,
    private readonly logger: Logger,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient,
  ) {}

  async list(
    currentUserId: number,
    isAdmin: boolean,
    query: TrashListQuery,
  ): Promise<TrashItemVO[]> {
    if (query.scope === 'all' && !isAdmin) {
      throw new ForbiddenException('仅管理员可查看全部回收站')
    }
    const filterCreatorId = query.scope === 'all' ? null : currentUserId
    const rows = await this.repo.listVisible(filterCreatorId)
    return rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      type: r.type,
      name: r.name,
      creatorId: r.creatorId,
      creatorName: r.creatorName ?? `user_${r.creatorId}`,
      deletedAt: r.deletedAt.toISOString(),
      deletedById: r.deletedById,
      deletedByName: r.deletedByName,
    }))
  }

  /**
   * 恢复整棵子树。
   *   - 原父已不在 active 状态 → 回到根（parentId=null），重建子树 path
   *   - 同级有同名活节点 → 409
   */
  async restore(
    currentUserId: number,
    isAdmin: boolean,
    nodeId: number,
  ): Promise<{ id: number; parentId: number | null }> {
    const node = await this.repo.findDeletedById(nodeId)
    if (!node) throw new NotFoundException('回收站中没有该节点')

    this.ensureMutationAllowed(currentUserId, isAdmin, node)

    // 决定目标父节点：原父仍 active → 用原父；否则寻找最近的 active 祖先；都没有 → 根
    let targetParentId: number | null = node.parentId
    if (targetParentId !== null) {
      const stillActive = await this.repo.existsActive(targetParentId)
      if (!stillActive) {
        // 沿 path 找最近活祖先；没有则归根
        const ancestor = await this.repo.findActiveAncestorId(node.path)
        targetParentId = ancestor
      }
    }

    // 命名冲突
    const conflict = await this.repo.existsActiveSiblingByName(
      targetParentId,
      node.name,
      node.id,
    )
    if (conflict) {
      throw new ConflictException('目标位置已存在同名节点，请先重命名或移除冲突项后再恢复')
    }

    // 计算新 path：若 parent 改变需要重写整棵子树
    const oldPath = node.path
    if (targetParentId !== node.parentId) {
      const parentPath = targetParentId === null
        ? null
        : (await this.nodeRepo.findActiveById(targetParentId))?.path ?? null
      const newPath = this.pathHelper.buildPath(parentPath, node.id)
      const parentDepth = await this.computeParentDepth(targetParentId)
      const newDepthSelf = parentDepth + 1
      const depthDelta = newDepthSelf - node.depth
      await this.nodeRepo.rewriteSubtreePaths(oldPath, newPath, depthDelta)
      await this.repo.updateRootParent(node.id, targetParentId)
      // 恢复用 newPath 来匹配子树
      await this.repo.restoreSubtree(newPath)
    } else {
      await this.repo.restoreSubtree(oldPath)
    }

    this.audit.log({
      userId: currentUserId,
      action: 'TRASH_RESTORE',
      targetType: 'NODE',
      targetId: node.id,
      detail: { name: node.name, originalParentId: node.parentId, restoredParentId: targetParentId },
    })

    return { id: node.id, parentId: targetParentId }
  }

  /**
   * 彻底删除整棵子树。
   *   - 删除 nodes + permissions + image_refs
   *   - 对失去全部 active 引用的图片：删 images 记录 + 删本地文件
   */
  async purge(
    currentUserId: number,
    isAdmin: boolean,
    nodeId: number,
  ): Promise<{ purgedNodeCount: number; purgedImageCount: number }> {
    const node = await this.repo.findDeletedById(nodeId)
    if (!node) throw new NotFoundException('回收站中没有该节点')

    this.ensureMutationAllowed(currentUserId, isAdmin, node)

    const result = await this.purgeSubtreeInternal(node.path)
    this.audit.log({
      userId: currentUserId,
      action: 'TRASH_PURGE',
      targetType: 'NODE',
      targetId: node.id,
      detail: { name: node.name, ...result },
    })
    return result
  }

  /** 30 天前软删的全部一键清理（由 PurgeJob 触发） */
  async purgeExpired(retentionDays: number): Promise<{ nodeCount: number; imageCount: number }> {
    const before = new Date(Date.now() - retentionDays * 24 * 3600 * 1000)
    const expired = await this.repo.listExpiredDeleted(before)
    if (expired.length === 0) return { nodeCount: 0, imageCount: 0 }

    // 直接按 id 列表彻底删；注意 id 集已经包含所有子节点（每个节点自己也匹配过期条件）
    // 但为安全起见，先按 path 聚合"根集合"，再走 purgeSubtreeInternal 复用图片清理逻辑
    const roots = pickPathRoots(expired.map((r) => r.path))
    let nodeCount = 0
    let imageCount = 0
    for (const rootPath of roots) {
      try {
        const r = await this.purgeSubtreeInternal(rootPath)
        nodeCount += r.purgedNodeCount
        imageCount += r.purgedImageCount
      } catch (err) {
        this.logger.warn({ err, rootPath }, 'trash purge expired 单条失败')
      }
    }
    this.logger.log({ nodeCount, imageCount, retentionDays }, 'trash: 过期清理完成')
    return { nodeCount, imageCount }
  }

  // ── 内部 ───────────────────────────────────────────────

  private async purgeSubtreeInternal(rootPath: string) {
    const subtree = await this.repo.listSubtreeIds(rootPath)
    if (subtree.length === 0) {
      return { purgedNodeCount: 0, purgedImageCount: 0 }
    }
    const allIds = subtree.map((r) => r.id)
    const docIds = subtree.filter((r) => r.type === 'DOC').map((r) => r.id)

    // 找需要随之物理删的图片（仅被此子树引用、再无其他活引用）
    const orphanImageIds = await this.repo.findOrphanImageIdsForDocs(docIds)
    let orphanStoragePaths: string[] = []
    if (orphanImageIds.length > 0) {
      const rows = await this.db
        .select({ id: images.id, storagePath: images.storagePath })
        .from(images)
        .where(inArray(images.id, orphanImageIds))
      orphanStoragePaths = rows.map((r) => r.storagePath)
    }

    // 先删 nodes + 关联引用
    await this.repo.hardDeleteNodes(allIds)
    // 再删图片记录 + 物理文件
    if (orphanImageIds.length > 0) {
      await this.db.delete(images).where(inArray(images.id, orphanImageIds))
      await Promise.allSettled(
        orphanStoragePaths.map((p) => this.imageStorage.delete(p)),
      )
    }

    return {
      purgedNodeCount: allIds.length,
      purgedImageCount: orphanImageIds.length,
    }
  }

  private ensureMutationAllowed(
    currentUserId: number,
    isAdmin: boolean,
    node: NodeRow,
  ): void {
    if (isAdmin) return
    if (node.creatorId === currentUserId) return
    if (node.deletedBy === currentUserId) return
    throw new ForbiddenException('只有创建者 / 删除者 / 管理员可以操作此项')
  }

  private async computeParentDepth(parentId: number | null): Promise<number> {
    if (parentId === null) return -1
    const p = await this.nodeRepo.findActiveById(parentId)
    if (!p) throw new BadRequestException('目标父节点不可用')
    return p.depth
  }
}

/**
 * 从一组 path 里挑出"根路径"集合：即不被其他 path 作为前缀祖先的路径。
 * 用于过期清理时只触发一次子树物理删，避免子节点被父操作之后又重复清理。
 */
function pickPathRoots(paths: string[]): string[] {
  const sorted = [...new Set(paths)].sort((a, b) => a.length - b.length)
  const roots: string[] = []
  for (const p of sorted) {
    const covered = roots.some((r) => p === r || p.startsWith(`${r}/`))
    if (!covered) roots.push(p)
  }
  return roots
}
