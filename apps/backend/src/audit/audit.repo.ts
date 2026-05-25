/**
 * operation_log 表 Drizzle 仓储
 * by AI.Coding
 */
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import type { DrizzleClient } from '../database/drizzle.client'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import {
  knownUsers,
  operationLog,
  type OperationLogInsert,
} from '../database/schema'

export interface AuditQueryFilter {
  userId?: number
  action?: string
  targetType?: string
  page: number
  pageSize: number
}

export interface AuditRowJoined {
  id: number
  userId: number
  userName: string | null
  action: string
  targetType: string
  targetId: number | null
  detail: unknown
  createdAt: Date
}

@Injectable()
export class AuditRepo {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient) {}

  async insert(input: OperationLogInsert): Promise<void> {
    await this.db.insert(operationLog).values(input)
  }

  async query(
    filter: AuditQueryFilter,
  ): Promise<{ items: AuditRowJoined[]; total: number }> {
    const conds: SQL[] = []
    if (filter.userId !== undefined) conds.push(eq(operationLog.userId, filter.userId))
    if (filter.action) conds.push(eq(operationLog.action, filter.action))
    if (filter.targetType) conds.push(eq(operationLog.targetType, filter.targetType))
    const whereExpr = conds.length > 0 ? and(...conds) : undefined

    const offset = (filter.page - 1) * filter.pageSize

    const rows = await this.db
      .select({
        id: operationLog.id,
        userId: operationLog.userId,
        userName: knownUsers.displayName,
        action: operationLog.action,
        targetType: operationLog.targetType,
        targetId: operationLog.targetId,
        detail: operationLog.detail,
        createdAt: operationLog.createdAt,
      })
      .from(operationLog)
      .leftJoin(knownUsers, eq(operationLog.userId, knownUsers.userId))
      .where(whereExpr)
      .orderBy(desc(operationLog.createdAt), desc(operationLog.id))
      .limit(filter.pageSize)
      .offset(offset)

    const totalRows = await this.db
      .select({ c: sql<number>`COUNT(*)` })
      .from(operationLog)
      .where(whereExpr)
    const total = Number(totalRows[0]?.c ?? 0)

    return { items: rows, total }
  }
}
