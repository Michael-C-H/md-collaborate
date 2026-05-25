/**
 * Permission 业务服务
 * by AI.Coding
 *
 * 关键决策：
 *   - ADMIN 旁路：role === 'ADMIN' 的用户视同任意节点的 MANAGE，不查表
 *   - 创建者旁路：节点的 creator_id === 当前 user_id 视同 MANAGE
 *     （创建时自动写一条 MANAGE 行；这里再做一次旁路兼容数据修复场景）
 *   - 角色层级 READ < WRITE < MANAGE，高级覆盖低级
 *   - 节点 creator 查询通过 drizzle 直查 nodes 表（不依赖 NodeModule，避免循环依赖）
 */
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, like } from 'drizzle-orm'
import type { PermissionRole, PermissionVO } from '@app/shared'
import { AuditService } from '../audit/audit.service'
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '../common/exceptions/app.exception'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import type { DrizzleClient } from '../database/drizzle.client'
import { nodes } from '../database/schema'
import { KnownUserRepo } from '../user/known-user.repo'
import { PermissionRepo } from './permission.repo'

/** 角色层级映射 */
const ROLE_LEVEL: Record<PermissionRole, number> = {
  READ: 1,
  WRITE: 2,
  MANAGE: 3,
}

/** role 是否满足 minRole 的最低要求 */
function meets(role: PermissionRole, minRole: PermissionRole): boolean {
  return (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[minRole] ?? 0)
}

@Injectable()
export class PermissionService {
  constructor(
    private readonly repo: PermissionRepo,
    private readonly knownUserRepo: KnownUserRepo,
    private readonly audit: AuditService,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient,
  ) {}

  /**
   * 检查 userId 在 nodeId 上是否满足 minRole。
   * @param creatorId 节点创建者 ID；传 undefined 时会内部查表
   */
  async hasMinRole(
    userId: number,
    isAdmin: boolean,
    nodeId: number,
    minRole: PermissionRole,
    creatorId?: number,
  ): Promise<boolean> {
    if (isAdmin) return true
    let creator = creatorId
    if (creator === undefined) {
      creator = await this.fetchCreatorId(nodeId)
    }
    if (creator === userId) return true
    const row = await this.repo.findByNodeAndUser(nodeId, userId)
    if (row) return meets(row.role as PermissionRole, minRole)

    // 直接权限未命中 → 向上查找祖先权限（继承）
    const ancestorRole = await this.getInheritedRole(userId, nodeId)
    if (!ancestorRole) return false
    // MANAGE 不继承：父文件夹的权限管理权不覆盖子文档
    const effective = ancestorRole === 'MANAGE' ? 'WRITE' : ancestorRole
    return meets(effective as PermissionRole, minRole)
  }

  /** 列出节点的协作者（聚合 known_users 的 displayName / username） */
  async listCollaborators(nodeId: number): Promise<PermissionVO[]> {
    const perms = await this.repo.listByNode(nodeId)
    if (perms.length === 0) return []
    const result: PermissionVO[] = []
    for (const p of perms) {
      const u = await this.knownUserRepo.findById(p.userId)
      result.push({
        userId: p.userId,
        username: u?.username ?? `user_${p.userId}`,
        displayName: u?.displayName ?? '未知用户',
        role: p.role as PermissionRole,
        ssoRole: u?.role === 'ADMIN' ? 'ADMIN' : 'USER',
      })
    }
    // 排序：MANAGE > WRITE > READ；同 role 按 displayName
    result.sort((a, b) => {
      const diff = (ROLE_LEVEL[b.role] ?? 0) - (ROLE_LEVEL[a.role] ?? 0)
      if (diff !== 0) return diff
      return a.displayName.localeCompare(b.displayName, 'zh-CN')
    })
    return result
  }

  /**
   * 授权 / 改权限
   *   currentUserId 必须是节点的 MANAGE（或 ADMIN）—— 由 controller 上的 Guard 校验
   *   targetUserId 必须存在于 known_users（即必须登录过本系统）
   */
  async grant(
    currentUserId: number,
    nodeId: number,
    targetUserId: number,
    role: PermissionRole,
  ): Promise<PermissionVO> {
    const target = await this.knownUserRepo.findById(targetUserId)
    if (!target) {
      throw new NotFoundException('被授权用户尚未访问本系统，无法添加')
    }
    await this.repo.upsert(nodeId, targetUserId, role, currentUserId)

    // 同步到所有子孙节点
    const descIds = await this.fetchDescendantIds(nodeId)
    if (descIds.length > 0) {
      await this.repo.upsertMany(
        descIds.map((id) => ({ nodeId: id, userId: targetUserId, role, createdBy: currentUserId })),
      )
    }

    this.audit.log({
      userId: currentUserId,
      action: 'PERMISSION_GRANT',
      targetType: 'NODE',
      targetId: nodeId,
      detail: { targetUserId, targetUsername: target.username, role, propagatedTo: descIds.length },
    })
    return {
      userId: targetUserId,
      username: target.username,
      displayName: target.displayName,
      role,
      ssoRole: target.role === 'ADMIN' ? 'ADMIN' : 'USER',
    }
  }

  /**
   * 撤权（不允许直接撤销创建者的 MANAGE）。
   */
  async revoke(currentUserId: number, nodeId: number, targetUserId: number): Promise<void> {
    const creatorId = await this.fetchCreatorId(nodeId)
    if (targetUserId === creatorId) {
      throw new BadRequestException('不能撤销创建者的管理权限')
    }
    const affected = await this.repo.delete(nodeId, targetUserId)
    if (affected === 0) {
      throw new NotFoundException('该用户没有节点权限')
    }

    // 级联删除子孙节点的权限
    const descIds = await this.fetchDescendantIds(nodeId)
    if (descIds.length > 0) {
      await this.repo.deleteByNodesAndUser(descIds, targetUserId)
    }

    this.audit.log({
      userId: currentUserId,
      action: 'PERMISSION_REVOKE',
      targetType: 'NODE',
      targetId: nodeId,
      detail: { targetUserId, cascadedTo: descIds.length },
    })
  }

  /** 节点 ID 列表中当前用户拥有任意权限的子集 */
  async listMyPermittedNodeIds(userId: number): Promise<number[]> {
    return this.repo.listNodeIdsByUser(userId)
  }

  /**
   * 创建节点时给创建者插入 MANAGE 权限。
   * 由 NodeService 在 create 完成后调用。
   */
  async grantInitialManage(nodeId: number, creatorId: number): Promise<void> {
    await this.repo.upsert(nodeId, creatorId, 'MANAGE', creatorId)
  }

  /** 内部：通过 path 查询祖先权限，返回最高角色 */
  private async getInheritedRole(userId: number, nodeId: number): Promise<string | null> {
    const rows = await this.db
      .select({ path: nodes.path })
      .from(nodes)
      .where(and(eq(nodes.id, nodeId), isNull(nodes.deletedAt)))
      .limit(1)
    const nodePath = rows[0]?.path
    if (!nodePath) return null
    // 解析祖先 ID："/3/9/12" → [3, 9, 12]，排除自身
    const ancestorIds = nodePath
      .split('/')
      .filter(Boolean)
      .map(Number)
      .filter((id) => id !== nodeId)
    if (ancestorIds.length === 0) return null
    return this.repo.findMaxRoleByNodesAndUser(ancestorIds, userId)
  }

  /** 内部：查节点 path，不存在返回 null */
  private async fetchNodePath(nodeId: number): Promise<string | null> {
    const rows = await this.db
      .select({ path: nodes.path })
      .from(nodes)
      .where(and(eq(nodes.id, nodeId), isNull(nodes.deletedAt)))
      .limit(1)
    return rows[0]?.path ?? null
  }

  /** 内部：查节点 path 前缀下的所有子孙节点 ID（不含自身） */
  private async fetchDescendantIds(nodeId: number): Promise<number[]> {
    const nodePath = await this.fetchNodePath(nodeId)
    if (!nodePath) return []
    // nodePath 形如 "/3/9"，子孙 path 为 "/3/9/12"、"/3/9/12/15" 等
    const rows = await this.db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(like(nodes.path, `${nodePath}/%`), isNull(nodes.deletedAt)))
    return rows.map((r) => r.id)
  }

  /** 内部：用 drizzle 直查节点 creator_id，节点不存在抛 NotFound */
  private async fetchCreatorId(nodeId: number): Promise<number> {
    const rows = await this.db
      .select({ creatorId: nodes.creatorId })
      .from(nodes)
      .where(and(eq(nodes.id, nodeId), isNull(nodes.deletedAt)))
      .limit(1)
    const node = rows[0]
    if (!node) throw new NotFoundException('节点不存在')
    return node.creatorId
  }
}

/** 暴露给 Guard 复用的最低角色判断（不依赖 ROLE_LEVEL 私有常量） */
export function roleMeets(role: PermissionRole, minRole: PermissionRole): boolean {
  return meets(role, minRole)
}

/** 校验角色字符串是否在合法集合内（防御性） */
export function assertValidRole(role: string): asserts role is PermissionRole {
  if (!(role in ROLE_LEVEL)) {
    throw new ForbiddenException('权限角色非法')
  }
}
