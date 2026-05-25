/**
 * @CurrentUser() 装饰器
 * by AI.Coding
 *
 * 从 iron-session 挂载在 request.session 上的 user 字段读取当前用户。
 * 鉴权由 SessionGuard 负责；本装饰器不做权限校验。
 */
import { ExecutionContext, createParamDecorator } from '@nestjs/common'
import { AuthException } from '../exceptions/app.exception'

/** 与 iron-session 中存储的用户字段一致 */
export interface CurrentUserPayload {
  userId: number
  username: string
  displayName: string
  role: 'ADMIN' | 'USER'
}

/** 从请求中提取当前登录用户；缺失时抛 AuthException（正常情况下守卫已拦截） */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const req = ctx.switchToHttp().getRequest<{ session?: { user?: CurrentUserPayload } }>()
    const user = req.session?.user
    if (!user) {
      throw new AuthException('请先登录')
    }
    return user
  },
)
