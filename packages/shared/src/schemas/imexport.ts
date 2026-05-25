/**
 * 导入导出相关 schema
 * by AI.Coding
 */
import { z } from 'zod'

/** 单个导入项的结果 */
export const ImportItemResultSchema = z.object({
  /** 原文件名（或 zip 内相对路径） */
  name: z.string(),
  success: z.boolean(),
  /** 成功时为新建的节点 id */
  nodeId: z.number().int().nullable(),
  /** 失败时的错误信息 */
  error: z.string().nullable(),
})
export type ImportItemResult = z.infer<typeof ImportItemResultSchema>

/** 导入结果 */
export const ImportResultSchema = z.object({
  items: z.array(ImportItemResultSchema),
})
export type ImportResult = z.infer<typeof ImportResultSchema>
