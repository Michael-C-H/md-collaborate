/**
 * 根模块
 * by AI.Coding
 *
 * 装配顺序：
 *   ConfigModule  → 启动时校验环境变量
 *   LoggerModule  → pino 日志，按 LOG_LEVEL / NODE_ENV 切换格式
 *   DatabaseModule + RedisModule  → 全局可注入的连接
 *   UserModule    → known_users 检索（被 AuthModule 用）
 *   AuthModule    → SSO 验证 / 会话 / 全局守卫
 *   NodeModule + PermissionModule → 文档树 + 权限（互相 forwardRef）
 *   HealthModule  → /api/health 探活
 *
 * 业务模块（collab/snapshot/image/...）将在后续批次按需 import 进来。
 */
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { LoggerModule } from 'nestjs-pino'
import { AdminModule } from './admin/admin.module'
import { AuditModule } from './audit/audit.module'
import { AuthModule } from './auth/auth.module'
import { CollabModule } from './collab/collab.module'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { ImageModule } from './image/image.module'
import { ImExportModule } from './imexport/imexport.module'
import { NodeModule } from './node/node.module'
import { PermissionModule } from './permission/permission.module'
import { RedisModule } from './redis/redis.module'
import { SnapshotModule } from './snapshot/snapshot.module'
import { TrashModule } from './trash/trash.module'
import { UserModule } from './user/user.module'
import { HealthModule } from './common/health/health.module'

@Module({
  imports: [
    ConfigModule,
    // ScheduleModule 必须在根模块 forRoot 一次，子模块用 @Cron 装饰器即可
    ScheduleModule.forRoot(),
    LoggerModule.forRootAsync({
      useFactory: () => ({
        pinoHttp: {
          level: process.env.LOG_LEVEL ?? 'info',
          transport:
            process.env.NODE_ENV === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'req.body.clientSecret',
              'req.body.ssoToken',
              'req.body.password',
              'req.body.oldPassword',
              'req.body.newPassword',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    DatabaseModule,
    RedisModule,
    UserModule,
    AuthModule,
    NodeModule,
    PermissionModule,
    CollabModule,
    ImageModule,
    SnapshotModule,
    ImExportModule,
    AuditModule,
    AdminModule,
    TrashModule,
    HealthModule,
  ],
})
export class AppModule {}
