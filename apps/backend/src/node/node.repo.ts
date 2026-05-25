/**
 * nodes 表的 Drizzle 仓储
 * by AI.Coding
 */
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'
import type { DrizzleClient } from '../database/drizzle.client'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import { nodes, type NodeInsert, type NodeRow } from '../database/schema'

@Injectable()
export class NodeRepo {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient) {}

  /** 不限状态查询 */
  async findById(id: number): Promise<NodeRow | null> {
    const rows = await this.db.select().from(nodes).where(eq(nodes.id, id)).limit(1)
    return rows[0] ?? null
  }

  /** 仅返回未软删的节点 */
  async findActiveById(id: number): Promise<NodeRow | null> {
    const rows = await this.db
      .select()
      .from(nodes)
      .where(and(eq(nodes.id, id), isNull(nodes.deletedAt)))
      .limit(1)
    return rows[0] ?? null
  }

  /** 列出所有 active 节点 */
  async listAllActive(): Promise<NodeRow[]> {
    return this.db.select().from(nodes).where(isNull(nodes.deletedAt))
  }

  /** 同级是否已有同名 active 节点（excludeId 用于 update 自身校验） */
  async existsSiblingByName(
    parentId: number | null,
    name: string,
    excludeId?: number,
  ): Promise<boolean> {
    const conds: SQL[] = [eq(nodes.name, name), isNull(nodes.deletedAt)]
    if (parentId === null) {
      conds.push(isNull(nodes.parentId))
    } else {
      conds.push(eq(nodes.parentId, parentId))
    }
    if (excludeId !== undefined) {
      conds.push(sql`${nodes.id} <> ${excludeId}`)
    }
    const rows = await this.db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(...conds))
      .limit(1)
    return rows.length > 0
  }

  /** 查询子树（含 self）的最大深度（仅 active） */
  async maxDepthOfSubtree(rootPath: string): Promise<number> {
    const rows = await this.db
      .select({ maxDepth: sql<number>`MAX(${nodes.depth})` })
      .from(nodes)
      .where(
        and(
          isNull(nodes.deletedAt),
          sql`(${nodes.path} = ${rootPath} OR ${nodes.path} LIKE ${`${rootPath}/%`})`,
        ),
      )
    return Number(rows[0]?.maxDepth ?? 0)
  }

  /**
   * 插入节点；返回新 id。
   *
   * Drizzle 0.30 的 MySQL 适配器还没有 $returningId（0.31+ 才有），
   * 这里走 mysql2 的 ResultSetHeader.insertId。
   */
  async insertAndReturnId(input: NodeInsert): Promise<number> {
    const result = await this.db.insert(nodes).values(input)
    // drizzle 0.30 mysql 的 insert 返回 mysql2 的 [ResultSetHeader, FieldPacket[]]
    const header = (result as unknown as Array<{ insertId?: number | string }>)[0]
    const insertId = header?.insertId
    if (insertId === undefined || insertId === null) {
      throw new Error('插入节点失败：未获取到 insertId')
    }
    return Number(insertId)
  }

  /** 创建后回写 path / depth */
  async updatePath(id: number, path: string, depth: number): Promise<void> {
    await this.db
      .update(nodes)
      .set({ path, depth, updatedAt: new Date() })
      .where(eq(nodes.id, id))
  }

  async updateName(id: number, name: string): Promise<void> {
    await this.db
      .update(nodes)
      .set({ name, updatedAt: new Date() })
      .where(eq(nodes.id, id))
  }

  async updateParent(id: number, parentId: number | null): Promise<void> {
    await this.db
      .update(nodes)
      .set({ parentId, updatedAt: new Date() })
      .where(eq(nodes.id, id))
  }

  /**
   * 重写子树 path 与 depth（移动操作用）。
   * 旧 path `oldPath` 的所有节点新 path = CONCAT(newPath, SUBSTRING(path, oldPath.length + 1))，
   * depth 整体加 depthDelta。
   */
  async rewriteSubtreePaths(
    oldPath: string,
    newPath: string,
    depthDelta: number,
  ): Promise<void> {
    await this.db
      .update(nodes)
      .set({
        path: sql`CONCAT(${newPath}, SUBSTRING(${nodes.path}, ${oldPath.length + 1}))`,
        depth: sql`${nodes.depth} + ${depthDelta}`,
        updatedAt: new Date(),
      })
      .where(
        sql`(${nodes.path} = ${oldPath} OR ${nodes.path} LIKE ${`${oldPath}/%`})`,
      )
  }

  /** 软删整棵子树 */
  async softDeleteSubtree(rootPath: string, deletedBy: number): Promise<void> {
    const now = new Date()
    await this.db
      .update(nodes)
      .set({ deletedAt: now, deletedBy, updatedAt: now })
      .where(
        and(
          isNull(nodes.deletedAt),
          sql`(${nodes.path} = ${rootPath} OR ${nodes.path} LIKE ${`${rootPath}/%`})`,
        ),
      )
  }

  /** 保存文档当前内容 */
  async saveDocContent(docId: number, markdown: string): Promise<void> {
    const now = new Date()
    await this.db
      .update(nodes)
      .set({ currentContent: markdown, contentUpdatedAt: now, updatedAt: now })
      .where(eq(nodes.id, docId))
  }
}
