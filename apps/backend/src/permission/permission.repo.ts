/**
 * permissions 表的 Drizzle 仓储
 * by AI.Coding
 */
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import type { DrizzleClient } from '../database/drizzle.client'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import { permissions, type PermissionRow } from '../database/schema'

@Injectable()
export class PermissionRepo {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient) {}

  /** 查询某节点的某用户权限 */
  async findByNodeAndUser(nodeId: number, userId: number): Promise<PermissionRow | null> {
    const rows = await this.db
      .select()
      .from(permissions)
      .where(and(eq(permissions.nodeId, nodeId), eq(permissions.userId, userId)))
      .limit(1)
    return rows[0] ?? null
  }

  /** 列出某节点的全部协作者权限 */
  async listByNode(nodeId: number): Promise<PermissionRow[]> {
    return this.db.select().from(permissions).where(eq(permissions.nodeId, nodeId))
  }

  /** 列出某用户拥有任意权限的节点 ID */
  async listNodeIdsByUser(userId: number): Promise<number[]> {
    const rows = await this.db
      .select({ nodeId: permissions.nodeId })
      .from(permissions)
      .where(eq(permissions.userId, userId))
    return rows.map((r) => r.nodeId)
  }

  /** 列出某些节点的所有权限（批量） */
  async listByNodes(nodeIds: number[]): Promise<PermissionRow[]> {
    if (nodeIds.length === 0) return []
    return this.db
      .select()
      .from(permissions)
      .where(inArray(permissions.nodeId, nodeIds))
  }

  /** upsert：存在则更新 role，不存在则插入 */
  async upsert(
    nodeId: number,
    userId: number,
    role: 'READ' | 'WRITE' | 'MANAGE',
    createdBy: number,
  ): Promise<void> {
    const now = new Date()
    await this.db
      .insert(permissions)
      .values({
        nodeId,
        userId,
        role,
        createdAt: now,
        createdBy,
      })
      .onDuplicateKeyUpdate({ set: { role } })
  }

  /** 移除某节点的某用户权限；返回受影响行数 */
  async delete(nodeId: number, userId: number): Promise<number> {
    const result = await this.db
      .delete(permissions)
      .where(and(eq(permissions.nodeId, nodeId), eq(permissions.userId, userId)))
    // mysql2 ResultSetHeader.affectedRows
    return (result as unknown as { affectedRows?: number }[])[0]?.affectedRows ?? 0
  }
}
