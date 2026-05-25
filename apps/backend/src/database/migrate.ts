/**
 * 数据库迁移脚本
 * by AI.Coding
 *
 * 用法：pnpm --filter @app/backend db:migrate
 *
 * 应用 ./drizzle 目录下由 drizzle-kit generate 生成的 SQL。
 * 首次运行前需要先 pnpm db:generate 生成迁移文件。
 *
 * .env 加载策略：从当前工作目录向上最多 6 层查找 .env，找到即停。
 * 这样无论从 monorepo 根（pnpm db:migrate）还是 apps/backend 目录（直接跑）都能命中。
 */
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'

/** 从 CWD 向上逐层查找 .env，命中即返回路径，否则返回 null */
function findEnvFile(): string | null {
  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env')
    if (existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

async function main(): Promise<void> {
  const envFile = findEnvFile()
  if (envFile) {
    loadEnv({ path: envFile })
    // eslint-disable-next-line no-console
    console.log(`[migrate] 已加载 .env：${envFile}`)
  } else {
    // eslint-disable-next-line no-console
    console.warn('[migrate] 未找到 .env，将使用进程环境变量')
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL 未配置；请检查 .env 或环境变量')
  }

  // 单次连接即可，不需要连接池
  const connection = await mysql.createConnection({ uri: url, multipleStatements: true })
  const db = drizzle(connection)

  // eslint-disable-next-line no-console
  console.log('[migrate] 开始应用迁移 …')
  await migrate(db, { migrationsFolder: './drizzle' })
  // eslint-disable-next-line no-console
  console.log('[migrate] 完成')

  await connection.end()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] 失败：', err)
  process.exit(1)
})
