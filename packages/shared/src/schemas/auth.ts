/**
 * 鉴权相关共享 schema
 * by AI.Coding
 */
import { z } from 'zod'

/** 当前登录用户视图（前端 GET /api/auth/me 的响应数据） */
export const CurrentUserSchema = z.object({
  userId: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  // 仅识别 ADMIN；其他来源角色统一归为 USER
  role: z.enum(['ADMIN', 'USER']),
})
export type CurrentUser = z.infer<typeof CurrentUserSchema>

/** 登出响应 */
export const LogoutResultSchema = z.object({
  /** 浏览器需要跳转到的三方系统首页 URL */
  redirectUrl: z.string().url(),
})
export type LogoutResult = z.infer<typeof LogoutResultSchema>

/** SSO 登录请求体（前端从 URL 上拿到 ssoToken 后 POST 给后端） */
export const SsoLoginRequestSchema = z.object({
  ssoToken: z.string().min(1, 'ssoToken 不能为空'),
})
export type SsoLoginRequest = z.infer<typeof SsoLoginRequestSchema>

/** SSO 登录失败时 ApiResult.data 携带的额外信息 */
export const SsoLoginErrorDataSchema = z.object({
  errorCode: z.string(),
})
export type SsoLoginErrorData = z.infer<typeof SsoLoginErrorDataSchema>
