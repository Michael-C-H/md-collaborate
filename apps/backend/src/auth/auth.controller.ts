/**
 * Auth controller
 * by AI.Coding
 *
 * GET  /api/auth/me         当前登录用户
 * POST /api/auth/login      本地用户名密码登录
 * POST /api/auth/sso-login  前端将 URL 上的 ssoToken 提交给后端走 SSO 登录
 * POST /api/auth/logout     销毁本地会话，返回跳转地址
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
  ChangePasswordRequestSchema,
  LoginRequestSchema,
  SsoLoginRequestSchema,
  type ChangePasswordRequest,
  type CurrentUser,
  type LoginRequest,
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

  /** 本地登录：用户名 + 密码 */
  @Post('login')
  @SkipAuth()
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  async login(
    @Body() body: LoginRequest,
    @Req() req: Request & { session: IronSession<SessionData> },
  ) {
    const result = await this.authService.login(body.username, body.password)
    if (!result) {
      return fail(401, '用户名或密码错误')
    }
    req.session.user = result
    await req.session.save()
    return ok(result)
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
      await this.knownUserService.upsertSso(ssoUser)

      // 查出内部 id
      const dbUser = await this.knownUserService.findByUsername(ssoUser.username)

      const payload: CurrentUser = {
        userId: dbUser.userId,
        username: ssoUser.username,
        displayName: ssoUser.displayName,
        role: ssoUser.role === 'ADMIN' ? 'ADMIN' : 'USER',
        loginType: 'SSO',
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

  /** 用户自助修改密码（仅 LOCAL 用户） */
  @Post('change-password')
  @UsePipes(new ZodValidationPipe(ChangePasswordRequestSchema))
  async changePassword(
    @Body() body: ChangePasswordRequest,
    @CurrentUserDecorator() user: CurrentUserPayload,
  ) {
    const result = await this.authService.changePassword(
      user.userId,
      body.oldPassword,
      body.newPassword,
    )
    if (result === null) {
      return fail(400, 'SSO 用户不支持修改密码')
    }
    if (!result) {
      return fail(400, '当前密码错误')
    }
    return ok(null)
  }

  /** 登出：销毁本地会话 */
  @Post('logout')
  @SkipAuth()
  logout(@Req() req: Request & { session: IronSession<SessionData> }) {
    const loginType = req.session?.user?.loginType
    if (req.session?.user) {
      req.session.destroy()
    }
    // SSO 用户跳 SSO 首页；LOCAL 用户返回 null（前端自行跳 /login）
    const redirectUrl = loginType === 'SSO' ? this.authService.getLogoutRedirectUrl() : null
    return ok({ redirectUrl })
  }
}
