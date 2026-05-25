/**
 * 仅 ADMIN 通过的守卫
 * by AI.Coding
 *
 * 配合 SessionGuard 使用：SessionGuard 保证 req.session.user 存在，AdminGuard 进一步限制角色。
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import type { IronSession } from 'iron-session'
import { ForbiddenException } from '../exceptions/app.exception'
import type { SessionData } from '../../auth/session.config'

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { session?: IronSession<SessionData> }>()
    const role = req.session?.user?.role
    if (role !== 'ADMIN') {
      throw new ForbiddenException('仅管理员可访问')
    }
    return true
  }
}
