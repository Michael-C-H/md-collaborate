/**
 * 操作审计相关共享 schema
 * by AI.Coding
 */
import { z } from 'zod'

/** 审计查询参数 */
export const AuditQuerySchema = z.object({
  /** 操作人 id 过滤 */
  userId: z.coerce.number().int().positive().optional(),
  /** 动作过滤（精确匹配） */
  action: z.string().max(64).optional(),
  /** 目标类型过滤 */
  targetType: z.string().max(32).optional(),
  /** 分页 */
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})
export type AuditQuery = z.infer<typeof AuditQuerySchema>

/** 审计日志条目（含操作人 displayName） */
export const AuditLogVOSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  userName: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.number().int().nullable(),
  detail: z.unknown().nullable(),
  createdAt: z.string(),
})
export type AuditLogVO = z.infer<typeof AuditLogVOSchema>

/** 分页响应 */
export const AuditPageSchema = z.object({
  items: z.array(AuditLogVOSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
})
export type AuditPage = z.infer<typeof AuditPageSchema>
