/**
 * Auth API 封装
 * by AI.Coding
 */
import type { CurrentUser, LogoutResult, SsoLoginErrorData } from '@app/shared'
import { http } from './http'

export const authApi = {
  /** GET /api/auth/me — 当前登录用户；未登录 → 401 */
  me: () => http.get<CurrentUser>('/auth/me'),
  /**
   * POST /api/auth/sso-login — 用 URL 上的 ssoToken 换取本地会话
   * 成功 res.code=0, res.data=CurrentUser；失败 res.code=401, res.data={errorCode}
   */
  ssoLogin: (ssoToken: string) =>
    http.post<CurrentUser | SsoLoginErrorData>('/auth/sso-login', { ssoToken }),
  /** POST /api/auth/logout — 销毁本地会话，返回三方首页 URL */
  logout: () => http.post<LogoutResult>('/auth/logout'),
}
