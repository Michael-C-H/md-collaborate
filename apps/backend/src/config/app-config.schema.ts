/**
 * 应用配置 Schema
 * by AI.Coding
 *
 * 启动时用 Zod 校验环境变量；任何字段缺失或非法都直接终止启动（fail-fast）。
 * 所有业务代码通过 ConfigService<AppConfig, true>().get('FOO', { infer: true }) 取值，享受类型推导。
 */
import { z } from 'zod'

export const AppConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_PORT: z.coerce.number().int().positive().default(3000),

  // MySQL：完整连接串（DSN）
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 必填'),

  // Redis
  REDIS_HOST: z.string().min(1, 'REDIS_HOST 必填'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  // 空密码场景下允许空字符串
  REDIS_PASSWORD: z.string().optional().default(''),

  // iron-session：cookie 加密密钥，长度 >= 32 字符
  SESSION_PASSWORD: z.string().min(32, 'SESSION_PASSWORD 必须 >= 32 字符的随机串'),
  SESSION_COOKIE_NAME: z.string().min(1).default('md_collab_session'),
  // cookie 的 Secure 标记：HTTPS 部署设 true；HTTP 局域网设 false（默认）
  // 设 true 时浏览器只在 HTTPS 下保存 / 发送该 cookie
  SESSION_COOKIE_SECURE: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  // SSO
  SSO_BASE_URL: z.string().url('SSO_BASE_URL 必须是合法 URL'),
  SSO_CLIENT_ID: z.string().min(1),
  SSO_CLIENT_SECRET: z.string().min(1),
  SSO_LOGOUT_REDIRECT: z.string().url('SSO_LOGOUT_REDIRECT 必须是合法 URL'),

  // 初始管理员（可选；配置后启动时自动创建）
  ADMIN_USERNAME: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(6).optional(),

  // 上传与边界
  UPLOAD_DIR: z.string().min(1, 'UPLOAD_DIR 必填'),
  MAX_IMAGE_SIZE_MB: z.coerce.number().int().positive().default(10),
  MAX_IMPORT_MD_SIZE_MB: z.coerce.number().int().positive().default(5),
  MAX_IMPORT_ZIP_SIZE_MB: z.coerce.number().int().positive().default(50),

  // 协同
  MAX_EDITORS_PER_DOC: z.coerce.number().int().positive().default(10),
  TOTAL_CONCURRENCY_LIMIT: z.coerce.number().int().positive().default(100),

  // 回收站保留天数（软删后 N 天彻底物理删除）
  TRASH_RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  // 日志
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

export type AppConfig = z.infer<typeof AppConfigSchema>
