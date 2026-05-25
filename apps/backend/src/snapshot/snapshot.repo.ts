/**
 * snapshots 表 Drizzle 仓储
 * by AI.Coding
 */
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, lte, sql } from 'drizzle-orm'
import type { DrizzleClient } from '../database/drizzle.client'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import { snapshots, type SnapshotInsert, type SnapshotRow } from '../database/schema'

@Injectable()
export class SnapshotRepo {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient) {}

  /** 列出文档全部快照，按 version_no 降序 */
  async listByDoc(docId: number): Promise<SnapshotRow[]> {
    return this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.docId, docId))
      .orderBy(desc(snapshots.versionNo))
  }

  async findByDocAndVersion(docId: number, versionNo: number): Promise<SnapshotRow | null> {
    const rows = await this.db
      .select()
      .from(snapshots)
      .where(and(eq(snapshots.docId, docId), eq(snapshots.versionNo, versionNo)))
      .limit(1)
    return rows[0] ?? null
  }

  /** 统计某文档某类型快照数（用于单文档手动快照 ≤ 100 校验） */
  async countByType(docId: number, type: string): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`COUNT(*)` })
      .from(snapshots)
      .where(and(eq(snapshots.docId, docId), eq(snapshots.type, type)))
    return Number(rows[0]?.c ?? 0)
  }

  /** 取当前最大 version_no（生成下一版本号用） */
  async maxVersionNo(docId: number): Promise<number> {
    const rows = await this.db
      .select({ m: sql<number>`MAX(${snapshots.versionNo})` })
      .from(snapshots)
      .where(eq(snapshots.docId, docId))
    return Number(rows[0]?.m ?? 0)
  }

  /** 取最近一次快照的 content_hash（AutoSnapshotJob 比对去重用） */
  async findLatestHash(docId: number): Promise<string | null> {
    const rows = await this.db
      .select({ hash: snapshots.contentHash })
      .from(snapshots)
      .where(eq(snapshots.docId, docId))
      .orderBy(desc(snapshots.versionNo))
      .limit(1)
    return rows[0]?.hash ?? null
  }

  async insertAndReturnId(input: SnapshotInsert): Promise<number> {
    const result = await this.db.insert(snapshots).values(input)
    const header = (result as unknown as Array<{ insertId?: number | string }>)[0]
    const insertId = header?.insertId
    if (insertId === undefined || insertId === null) {
      throw new Error('插入快照失败：未获取到 insertId')
    }
    return Number(insertId)
  }

  /** 清理 expires_at <= now 的 AUTO 快照；返回受影响行数 */
  async deleteExpired(now: Date): Promise<number> {
    const result = await this.db
      .delete(snapshots)
      .where(and(eq(snapshots.type, 'AUTO'), lte(snapshots.expiresAt, now)))
    const header = (result as unknown as Array<{ affectedRows?: number }>)[0]
    return header?.affectedRows ?? 0
  }
}
