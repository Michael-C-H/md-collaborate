/**
 * Auth 模块
 * by AI.Coding
 *
 * - 注册 SsoTokenMiddleware 为 global middleware（每个请求都先经过它处理 session）
 * - 注册 SessionGuard 为 APP_GUARD，所有路由默认需登录；标 @SkipAuth() 跳过
 * - 导出 AuthService 和 SsoVerifyClient 供其他模块调用
 */
import { Global, MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { UserModule } from '../user/user.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { SsoTokenMiddleware } from './sso-token.middleware'
import { SsoVerifyClient } from './sso-verify.client'
import { SessionGuard } from './session.guard'

@Global()
@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SsoVerifyClient,
    SsoTokenMiddleware,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [AuthService, SsoVerifyClient],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 应用到所有路由；中间件本身只在有 ssoToken 时做登录处理
    consumer.apply(SsoTokenMiddleware).forRoutes('*')
  }
}
