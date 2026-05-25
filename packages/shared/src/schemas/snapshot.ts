/**
 * 版本快照相关 schema
 * by AI.Coding
 */
import { z } from 'zod'
import { SnapshotTypeSchema } from '../types/role.js'

/** 创建手动快照请求 */
export const CreateSnapshotSchema = z.object({
  name: z.string().min(1, '快照名称不能为空').max(50, '名称最多 50 字符'),
})
export type CreateSnapshotDto = z.infer<typeof CreateSnapshotSchema>

/** 恢复快照请求 */
export const RestoreSnapshotSchema = z.object({
  /** 强制恢复（即使有人在线编辑也覆盖） */
  force: z.boolean().optional().default(false),
})
export type RestoreSnapshotDto = z.infer<typeof RestoreSnapshotSchema>

/** 快照列表项视图（不含正文） */
export const SnapshotVOSchema = z.object({
  id: z.number().int(),
  versionNo: z.number().int(),
  type: SnapshotTypeSchema,
  name: z.string().nullable(),
  restoredFrom: z.number().int().nullable(),
  createdAt: z.string(),
  createdBy: z.number().int(),
  createdByName: z.string(),
  expiresAt: z.string().nullable(),
})
export type SnapshotVO = z.infer<typeof SnapshotVOSchema>

/** 快照详情视图（含正文） */
export const SnapshotContentVOSchema = SnapshotVOSchema.extend({
  content: z.string(),
})
export type SnapshotContentVO = z.infer<typeof SnapshotContentVOSchema>

/** 恢复冲突时的 data 结构（HTTP 409） */
export const RestoreConflictDataSchema = z.object({
  editorCount: z.number().int(),
})
export type RestoreConflictData = z.infer<typeof RestoreConflictDataSchema>
