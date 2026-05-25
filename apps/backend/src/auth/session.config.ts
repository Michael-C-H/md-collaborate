/**
 * iron-session 配置 + 会话数据类型
 * by AI.Coding
 *
 * iron-session 把会话加密后存到 cookie，无需服务端存储；本项目仍引入 Redis 是为
 * 后续可能的"登出黑名单"或多实例会话同步预留口子，但 MVP 直接靠 cookie 即可工作。
 */
import type { SessionOptions } from 'iron-session'
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator'

/** 服务端会话承载的数据结构 */
export interface SessionData {
  /** 已登录用户；空表示未登录 */
  user?: CurrentUserPayload
}

/** 构造 iron-session 选项 */
export function buildSessionOptions(
  password: string,
  cookieName: string,
  secure: boolean,
): SessionOptions {
  return {
    password,
    cookieName,
    cookieOptions: {
      httpOnly: true,
      // 由 SESSION_COOKIE_SECURE 控制；HTTP 部署务必 false，否则浏览器不存 cookie
      secure,
      // 同站默认；前后端同域时无跨站需求
      sameSite: 'lax',
      // 30 天有效期（用户长时间不操作仍可登录）
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    },
  }
}
