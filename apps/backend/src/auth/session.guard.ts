/**
 * 全局会话守卫
 * by AI.Coding
 *
 * 默认：所有路由都需要登录。
 * 例外：在 controller / handler 上加 @SkipAuth() 装饰器即可放行（适合 /health、登出等）。
 */
import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { IronSession } from 'iron-session'
import { AuthException } from '../common/exceptions/app.exception'
import type { SessionData } from './session.config'

/** Reflector key */
export const SKIP_AUTH_KEY = 'skip-auth'

/** 路由装饰器：跳过会话校验 */
export const SkipAuth = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_AUTH_KEY, true)

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // 类 / 方法上任一标注了 @SkipAuth 都放行
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (skip) return true

    const req = ctx
      .switchToHttp()
      .getRequest<Request & { session?: IronSession<SessionData> }>()
    if (!req.session?.user) {
      throw new AuthException('请先登录')
    }
    return true
  }
}
