/**
 * 用户检索相关共享 schema
 * by AI.Coding
 *
 * 注意：known_users 只是"已登录用户的本地缓存"，不参与认证。
 */
import { z } from 'zod'
import { LoginTypeSchema, UserRoleSchema } from '../types/role.js'

/** known_users 对外视图 */
export const KnownUserVOSchema = z.object({
  userId: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  role: UserRoleSchema,
  loginType: LoginTypeSchema,
})
export type KnownUserVO = z.infer<typeof KnownUserVOSchema>

/** 模糊检索请求参数 */
export const SearchUserQuerySchema = z.object({
  q: z.string().min(1, '检索关键词不能为空').max(64),
  limit: z.coerce.number().int().positive().max(50).default(20),
})
export type SearchUserQuery = z.infer<typeof SearchUserQuerySchema>

/** 管理员用户列表查询参数 */
export const AdminUserListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  keyword: z.string().max(64).optional(),
})
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>

/** 管理员用户列表响应 */
export const AdminUserListSchema = z.object({
  total: z.number().int(),
  list: z.array(KnownUserVOSchema),
})
export type AdminUserList = z.infer<typeof AdminUserListSchema>
