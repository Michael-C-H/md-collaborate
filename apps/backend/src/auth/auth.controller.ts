/**
 * Auth controller
 * by AI.Coding
 *
 * GET  /api/auth/me         当前登录用户
 * POST /api/auth/sso-login  前端将 URL 上的 ssoToken 提交给后端走 SSO 登录
 * POST /api/auth/logout     销毁本地会话，返回三方首页地址
 */
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UsePipes,
} from '@nestjs/common'
import type { Request } from 'express'
import type { IronSession } from 'iron-session'
import {
  SsoLoginRequestSchema,
  type CurrentUser,
  type SsoLoginRequest,
} from '@app/shared'
import { fail, ok } from '../common/api-result'
import { CurrentUser as CurrentUserDecorator, type CurrentUserPayload } from '../common/decorators/current-user.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { SsoVerifyException } from '../common/exceptions/sso-verify.exception'
import { KnownUserService } from '../user/user.service'
import { AuthService } from './auth.service'
import { SkipAuth } from './session.guard'
import type { SessionData } from './session.config'
import { SsoVerifyClient } from './sso-verify.client'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verifyClient: SsoVerifyClient,
    private readonly knownUserService: KnownUserService,
  ) {}

  /** 当前登录用户；无会话由 SessionGuard 拦截 → 401 */
  @Get('me')
  me(@CurrentUserDecorator() user: CurrentUserPayload) {
    return ok(user)
  }

  /**
   * SSO 登录：前端检测到 URL 上的 ssoToken 后调用本接口。
   *   成功 → 写本地 session、upsert known_users，返回 CurrentUser
   *   失败 → 返回 ApiResult.code=401，data 含 errorCode；前端据此跳 /login-error
   *
   * 设计上还保留了 SsoTokenMiddleware 在请求 query 中拦截 ssoToken 的兜底逻辑，
   * 供"浏览器直接打到后端"的部署形态使用；dev 模式（vite proxy）下走本接口更稳。
   */
  @Post('sso-login')
  @SkipAuth()
  @UsePipes(new ZodValidationPipe(SsoLoginRequestSchema))
  async ssoLogin(
    @Body() body: SsoLoginRequest,
    @Req() req: Request & { session: IronSession<SessionData> },
  ) {
    try {
      const ssoUser = await this.verifyClient.verify(body.ssoToken)
      await this.knownUserService.upsert(ssoUser)

      const payload: CurrentUser = {
        userId: ssoUser.userId,
        username: ssoUser.username,
        displayName: ssoUser.displayName,
        role: ssoUser.role === 'ADMIN' ? 'ADMIN' : 'USER',
      }
      req.session.user = payload
      await req.session.save()
      return ok(payload)
    } catch (err) {
      if (err instanceof SsoVerifyException) {
        // 让前端拿到具体 errorCode 后跳 /login-error
        return fail(err.httpStatus, err.message, { errorCode: err.errorCode })
      }
      throw err
    }
  }

  /** 登出：销毁本地会话 */
  @Post('logout')
  @SkipAuth()
  logout(@Req() req: Request & { session: IronSession<SessionData> }) {
    if (req.session?.user) {
      // iron-session 的 destroy() 同步清除内存数据 + 写过期的 Set-Cookie
      req.session.destroy()
    }
    return ok({ redirectUrl: this.authService.getLogoutRedirectUrl() })
  }
}
