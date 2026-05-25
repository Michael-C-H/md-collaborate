/**
 * 配置模块：加载环境变量、Zod 校验
 * by AI.Coding
 *
 * 设为 isGlobal，所有模块可直接 inject ConfigService<AppConfig, true>。
 *
 * .env 寻路：同时尝试当前目录与 monorepo 根（向上两级）。
 * 这样无论从 monorepo 根（pnpm dev:backend）还是 apps/backend 目录启动，
 * 都能正确加载根目录的 .env。命中先后顺序：本地覆盖 > 项目根本机覆盖 > 根 .env。
 */
import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import path from 'node:path'
import { AppConfigSchema } from './app-config.schema'

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // 优先 .env.local，其次 .env；同时覆盖 CWD 与 monorepo 根（../../）
      envFilePath: [
        '.env.local',
        '.env',
        path.resolve(process.cwd(), '..', '..', '.env.local'),
        path.resolve(process.cwd(), '..', '..', '.env'),
      ],
      // Zod 校验；失败时 throw 阻塞启动
      validate: (raw) => {
        const result = AppConfigSchema.safeParse(raw)
        if (!result.success) {
          const issues = result.error.errors
            .map((e) => `  - ${e.path.join('.') || '<root>'}: ${e.message}`)
            .join('\n')
          throw new Error(`环境变量校验失败：\n${issues}`)
        }
        return result.data
      },
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
