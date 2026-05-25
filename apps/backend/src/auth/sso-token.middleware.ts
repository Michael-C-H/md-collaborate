/**
 * SSO ssoToken 拦截 + 会话挂载中间件
 * by AI.Coding
 *
 * 职责：
 *   1. 每个请求开头先调用 iron-session 解出当前会话并挂到 req.session（后续 controller / guard 直接用）。
 *   2. 若 URL 含 ?ssoToken=xxx：
 *      a) 调三方 verify
 *      b) upsert known_users
 *      c) 写本地 session
 *      d) 302 到去掉 ssoToken 的同 URL
 *   3. 若 verify 失败：
 *      - 已有有效会话 → 忽略本次 ssoToken，正常进入
 *      - 否则跳 /login-error?code=<error_code>
 */
import { Injectable, NestMiddleware } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NextFunction, Request, Response } from 'express'
import { getIronSession, type IronSession } from 'iron-session'
import { Logger } from 'nestjs-pino'
import { SsoVerifyException } from '../common/exceptions/sso-verify.exception'
import { KnownUserService } from '../user/user.service'
import type { AppConfig } from '../config/app-config.schema'
import { buildSessionOptions, type SessionData } from './session.config'
import { SsoVerifyClient } from './sso-verify.client'

/** 去掉 URL 查询串中的 ssoToken 参数，保留其他参数与原路径 */
function stripSsoToken(originalUrl: string): string {
  const [pathPart, queryPart] = originalUrl.split('?')
  const base = pathPart ?? '/'
  if (!queryPart) return base
  const params = new URLSearchParams(queryPart)
  params.delete('ssoToken')
  const rest = params.toString()
  return rest ? `${base}?${rest}` : base
}

@Injectable()
export class SsoTokenMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly verifyClient: SsoVerifyClient,
    private readonly knownUserService: KnownUserService,
    private readonly logger: Logger,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const sessionOpts = buildSessionOptions(
      this.config.get('SESSION_PASSWORD', { infer: true }),
      this.config.get('SESSION_COOKIE_NAME', { infer: true }),
      this.config.get('SESSION_COOKIE_SECURE', { infer: true }),
    )
    // 解出会话并挂在 req 上，后续路由可通过 (req as any).session 访问
    const session: IronSession<SessionData> = await getIronSession<SessionData>(
      req,
      res,
      sessionOpts,
    )
    ;(req as Request & { session: IronSession<SessionData> }).session = session

    // 没有 ssoToken 或 SSO 未配置 → 不处理登录，直接放行
    const ssoBaseUrl = this.config.get('SSO_BASE_URL', { infer: true })
    const ssoToken = typeof req.query.ssoToken === 'string' ? req.query.ssoToken : undefined
    if (!ssoToken || !ssoBaseUrl) {
      return next()
    }

    try {
      // 调三方校验
      const ssoUser = await this.verifyClient.verify(ssoToken)

      // 写入/更新 known_users（用户本地镜像，用于后续分享检索）
      await this.knownUserService.upsertSso(ssoUser)

      // 查出内部 id（upsert 后 user_id 可能与 id 不同）
      const dbUser = await this.knownUserService.findByUsername(ssoUser.username)

      // 写入本地会话
      session.user = {
        userId: dbUser.userId,
        username: ssoUser.username,
        displayName: ssoUser.displayName,
        role: ssoUser.role === 'ADMIN' ? 'ADMIN' : 'USER',
        loginType: 'SSO',
      }
      await session.save()

      // 重定向去掉 ssoToken 参数
      res.redirect(302, stripSsoToken(req.originalUrl))
    } catch (err) {
      if (err instanceof SsoVerifyException) {
        this.logger.warn({ errorCode: err.errorCode }, 'SSO 验证失败')
        // 若已有有效会话（例如用户刷新页面带了旧 token），忽略本次失败、保留会话
        if (session.user) {
          res.redirect(302, stripSsoToken(req.originalUrl))
          return
        }
        res.redirect(302, `/login-error?code=${encodeURIComponent(err.errorCode)}`)
        return
      }
      // 其他异常交给全局错误处理
      next(err)
    }
  }
}
