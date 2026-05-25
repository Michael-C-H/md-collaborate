/**
 * 角色与权限枚举
 * by AI.Coding
 */

import { z } from 'zod'

/** 文档级权限角色（来自 permissions 表） */
export const PermissionRoleSchema = z.enum(['READ', 'WRITE', 'MANAGE'])
export type PermissionRole = z.infer<typeof PermissionRoleSchema>

/** SSO 返回的用户角色；当前 MVP 只识别 ADMIN，其余按普通用户处理 */
export const SsoRoleSchema = z.enum(['ADMIN', 'USER'])
export type SsoRole = z.infer<typeof SsoRoleSchema>

/** 节点类型 */
export const NodeTypeSchema = z.enum(['FOLDER', 'DOC'])
export type NodeType = z.infer<typeof NodeTypeSchema>

/** 快照类型 */
export const SnapshotTypeSchema = z.enum(['AUTO', 'MANUAL', 'RESTORE_FROM'])
export type SnapshotType = z.infer<typeof SnapshotTypeSchema>
