/**
 * 图片上传相关 schema
 * by AI.Coding
 */
import { z } from 'zod'

/** 图片上传成功响应数据 */
export const ImageUploadResultSchema = z.object({
  url: z.string(),
  urlToken: z.string(),
  sizeBytes: z.number().int(),
  mimeType: z.string(),
})
export type ImageUploadResult = z.infer<typeof ImageUploadResultSchema>
