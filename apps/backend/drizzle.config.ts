/**
 * Drizzle Kit 配置
 * by AI.Coding
 *
 * 用于：
 *   pnpm db:generate  → 根据 schema.ts 生成 SQL 迁移到 ./drizzle
 *   pnpm db:migrate   → 用 tsx 执行 src/database/migrate.ts，应用 ./drizzle 下的 SQL
 *
 * .env 寻路：从当前目录向上最多 6 层查找 .env，找到即停。
 * 这样无论从 monorepo 根（pnpm db:generate）还是 apps/backend 目录都能命中。
 */
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Config } from 'drizzle-kit'

/** 从 CWD 向上逐层查找 .env */
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

const envFile = findEnvFile()
if (envFile) {
  loadEnv({ path: envFile })
}

export default {
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
} satisfies Config
