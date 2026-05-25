/**
 * known_users 表的 Drizzle 仓储
 * by AI.Coding
 *
 * 提供 upsert、按 id / username 精确查询、按关键字模糊检索、本地用户 CRUD。
 */
import { Inject, Injectable } from '@nestjs/common'
import { asc, count, eq, like, or, sql } from 'drizzle-orm'
import type { DrizzleClient } from '../database/drizzle.client'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import { knownUsers, type KnownUserRow } from '../database/schema'

@Injectable()
export class KnownUserRepo {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient) {}

  /** SSO 登录时调用：存在则更新 last_login_at / displayName / role，不存在则插入 */
  async upsertSso(input: {
    userId: number
    username: string
    displayName: string
    role: string
  }): Promise<void> {
    const now = new Date()
    await this.db
      .insert(knownUsers)
      .values({
        userId: input.userId,
        loginType: 'SSO',
        username: input.username,
        displayName: input.displayName,
        role: input.role,
        firstLoginAt: now,
        lastLoginAt: now,
      })
      .onDuplicateKeyUpdate({
        set: {
          username: input.username,
          displayName: input.displayName,
          role: input.role,
          lastLoginAt: now,
        },
      })
  }

  /** 创建本地用户 */
  async createLocal(input: {
    username: string
    passwordHash: string
    displayName: string
    role: string
  }): Promise<KnownUserRow> {
    const now = new Date()
    const result = await this.db
      .insert(knownUsers)
      .values({
        loginType: 'LOCAL',
        username: input.username,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: input.role,
        firstLoginAt: now,
        lastLoginAt: now,
      })
    // Fetch the inserted row
    const insertedId = Number(result[0].insertId)
    const row = await this.findById(insertedId)
    return row!
  }

  /** 按 id 精确查询（新主键） */
  async findById(id: number): Promise<KnownUserRow | null> {
    const rows = await this.db
      .select()
      .from(knownUsers)
      .where(eq(knownUsers.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  /** 按 username 精确查询 */
  async findByUsername(username: string): Promise<KnownUserRow | null> {
    const rows = await this.db
      .select()
      .from(knownUsers)
      .where(eq(knownUsers.username, username))
      .limit(1)
    return rows[0] ?? null
  }

  /** 按关键字模糊检索 username / display_name，按 displayName 字典序返回 */
  async searchByKeyword(keyword: string, limit: number): Promise<KnownUserRow[]> {
    const pattern = `%${keyword}%`
    return this.db
      .select()
      .from(knownUsers)
      .where(or(like(knownUsers.username, pattern), like(knownUsers.displayName, pattern)))
      .orderBy(asc(knownUsers.displayName))
      .limit(limit)
  }

  /** 更新用户字段 */
  async updateById(id: number, input: {
    displayName?: string
    role?: string
    passwordHash?: string
  }): Promise<void> {
    const set: Record<string, unknown> = {}
    if (input.displayName !== undefined) set.displayName = input.displayName
    if (input.role !== undefined) set.role = input.role
    if (input.passwordHash !== undefined) set.passwordHash = input.passwordHash
    if (Object.keys(set).length === 0) return
    await this.db.update(knownUsers).set(set).where(eq(knownUsers.id, id))
  }

  /** 删除用户 */
  async deleteById(id: number): Promise<void> {
    await this.db.delete(knownUsers).where(eq(knownUsers.id, id))
  }

  /** 分页查询用户列表（管理员用） */
  async findAllPaginated(
    page: number,
    pageSize: number,
    keyword?: string,
  ): Promise<{ list: KnownUserRow[]; total: number }> {
    const offset = (page - 1) * pageSize
    const conds = keyword
      ? or(
          like(knownUsers.username, `%${keyword}%`),
          like(knownUsers.displayName, `%${keyword}%`),
        )
      : undefined

    const [list, totalRows] = await Promise.all([
      this.db
        .select()
        .from(knownUsers)
        .where(conds)
        .orderBy(asc(knownUsers.id))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ c: count() })
        .from(knownUsers)
        .where(conds),
    ])

    return { list, total: Number(totalRows[0]?.c ?? 0) }
  }

  /** 批量按 id 查询 */
  async findByIds(ids: number[]): Promise<KnownUserRow[]> {
    if (ids.length === 0) return []
    return this.db
      .select()
      .from(knownUsers)
      .where(sql`${knownUsers.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
  }
}
