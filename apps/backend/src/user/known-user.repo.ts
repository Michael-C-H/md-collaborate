/**
 * known_users 表的 Drizzle 仓储
 * by AI.Coding
 *
 * 提供 upsert、按 id / username 精确查询、按关键字模糊检索。
 */
import { Inject, Injectable } from '@nestjs/common'
import { asc, eq, like, or } from 'drizzle-orm'
import type { DrizzleClient } from '../database/drizzle.client'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import { knownUsers, type KnownUserRow } from '../database/schema'

@Injectable()
export class KnownUserRepo {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient) {}

  /** 登录时调用：存在则更新 last_login_at / displayName / role，不存在则插入 */
  async upsert(input: {
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

  /** 按 userId 精确查询 */
  async findById(userId: number): Promise<KnownUserRow | null> {
    const rows = await this.db
      .select()
      .from(knownUsers)
      .where(eq(knownUsers.userId, userId))
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
}
