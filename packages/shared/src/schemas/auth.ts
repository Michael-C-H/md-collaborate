/**
 * 鉴权相关共享 schema
 * by AI.Coding
 */
import { z } from 'zod'
import { LoginTypeSchema, UserRoleSchema } from '../types/role.js'

/** 当前登录用户视图（前端 GET /api/auth/me 的响应数据） */
export const CurrentUserSchema = z.object({
  userId: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  role: UserRoleSchema,
  loginType: LoginTypeSchema,
})
export type CurrentUser = z.infer<typeof CurrentUserSchema>

/** 登出响应 */
export const LogoutResultSchema = z.object({
  /** 浏览器需要跳转到的三方系统首页 URL；LOCAL 用户为 null */
  redirectUrl: z.string().url().nullable(),
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

/** 本地登录请求体 */
export const LoginRequestSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(64),
  password: z.string().min(1, '密码不能为空').max(128),
})
export type LoginRequest = z.infer<typeof LoginRequestSchema>

/** 管理员创建用户请求体 */
export const CreateUserRequestSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符').max(64),
  password: z.string().min(6, '密码至少 6 个字符').max(128),
  displayName: z.string().max(128).optional(),
  role: UserRoleSchema.optional().default('USER'),
})
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>

/** 管理员修改用户请求体 */
export const UpdateUserRequestSchema = z.object({
  displayName: z.string().max(128).optional(),
  role: UserRoleSchema.optional(),
  password: z.string().min(6, '密码至少 6 个字符').max(128).optional(),
})
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>

/** 用户自助修改密码请求体 */
export const ChangePasswordRequestSchema = z.object({
  oldPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少 6 个字符').max(128),
})
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>
