/**
 * 角色与权限枚举
 * by AI.Coding
 */

import { z } from 'zod'

/** 文档级权限角色（来自 permissions 表） */
export const PermissionRoleSchema = z.enum(['READ', 'WRITE', 'MANAGE'])
export type PermissionRole = z.infer<typeof PermissionRoleSchema>

/** 用户角色：管理员 / 普通用户 */
export const UserRoleSchema = z.enum(['ADMIN', 'USER'])
export type UserRole = z.infer<typeof UserRoleSchema>

/** 兼容旧名 */
export const SsoRoleSchema = UserRoleSchema
export type SsoRole = UserRole

/** 登录来源 */
export const LoginTypeSchema = z.enum(['SSO', 'LOCAL'])
export type LoginType = z.infer<typeof LoginTypeSchema>

/** 节点类型 */
export const NodeTypeSchema = z.enum(['FOLDER', 'DOC'])
export type NodeType = z.infer<typeof NodeTypeSchema>

/** 快照类型 */
export const SnapshotTypeSchema = z.enum(['AUTO', 'MANUAL', 'RESTORE_FROM'])
export type SnapshotType = z.infer<typeof SnapshotTypeSchema>
