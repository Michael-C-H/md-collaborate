/**
 * Redis 模块：全局 ioredis 客户端
 * by AI.Coding
 *
 * 用途：
 *   - Session 数据 mirror（iron-session 加密 cookie 即可工作，但 Redis 用于"登出黑名单"等）
 *   - 协同在线状态（editors:{docId} 集合）
 *   - 定时任务分布式锁（虽然单实例，留下口子便于未来扩展）
 */
import { Global, Module, type OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { REDIS_TOKEN } from './redis.tokens'
import type { AppConfig } from '../config/app-config.schema'

@Global()
@Module({
  providers: [
    {
      provide: REDIS_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): Redis => {
        const password = config.get('REDIS_PASSWORD', { infer: true })
        return new Redis({
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
          // 空字符串视为无密码
          password: password ? password : undefined,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        })
      },
    },
  ],
  exports: [REDIS_TOKEN],
})
export class RedisModule implements OnApplicationShutdown {
  // 应用关闭时优雅释放连接；具体实现由 ioredis 自身管理
  async onApplicationShutdown(): Promise<void> {
    // ioredis 在 SIGTERM 时会自动 quit；这里保留钩子便于未来加自定义清理
  }
}
