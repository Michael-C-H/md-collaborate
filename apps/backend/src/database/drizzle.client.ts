/**
 * Drizzle MySQL client 工厂
 * by AI.Coding
 *
 * 使用连接池（mysql2/promise.createPool）；并发上限按本项目 100 用户设计，池大小 20 足够。
 */
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'

export type DrizzleClient = MySql2Database<typeof schema>

/** 根据 DATABASE_URL 创建一个 Drizzle 客户端实例 */
export async function createDrizzleClient(databaseUrl: string): Promise<DrizzleClient> {
  const pool = mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 20,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    // 启用 utf8mb4 + 大数字以字符串返回（避免 bigint 精度问题）
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: false,
  })

  // 启动期做一次 ping，连不上立即失败
  const conn = await pool.getConnection()
  await conn.ping()
  conn.release()

  return drizzle(pool, { schema, mode: 'default' })
}
