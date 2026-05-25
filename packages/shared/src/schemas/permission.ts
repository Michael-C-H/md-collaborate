/**
 * 文档权限相关共享 schema
 * by AI.Coding
 */
import { z } from 'zod'
import { PermissionRoleSchema } from '../types/role.js'

/** 授权请求体（PUT /api/nodes/:id/permissions/:userId） */
export const GrantPermissionSchema = z.object({
  role: PermissionRoleSchema,
})
export type GrantPermissionDto = z.infer<typeof GrantPermissionSchema>

/** 协作者列表项视图 */
export const PermissionVOSchema = z.object({
  userId: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  role: PermissionRoleSchema,
  /** 仅展示用：来自 known_users.role；非 ADMIN 都是 USER */
  ssoRole: z.enum(['ADMIN', 'USER']),
})
export type PermissionVO = z.infer<typeof PermissionVOSchema>
