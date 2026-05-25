/**
 * 回收站相关共享 schema
 * by AI.Coding
 */
import { z } from 'zod'
import { NodeTypeSchema } from '../types/role.js'

/** 列表查询：scope=mine 普通用户；scope=all 仅 ADMIN */
export const TrashListQuerySchema = z.object({
  scope: z.enum(['mine', 'all']).default('mine'),
})
export type TrashListQuery = z.infer<typeof TrashListQuerySchema>

/** 回收站条目（不含 path / 子内容） */
export const TrashItemVOSchema = z.object({
  id: z.number().int(),
  /** 原父 id；可能已被删除 */
  parentId: z.number().int().nullable(),
  type: NodeTypeSchema,
  name: z.string(),
  /** 创建者 id + name（便于 admin 视图展示） */
  creatorId: z.number().int(),
  creatorName: z.string(),
  /** 软删时间 / 删除者 */
  deletedAt: z.string(),
  deletedById: z.number().int().nullable(),
  deletedByName: z.string().nullable(),
})
export type TrashItemVO = z.infer<typeof TrashItemVOSchema>

/** 彻底删除时的必填确认串：?confirm=YES */
export const PURGE_CONFIRM_TOKEN = 'YES'
