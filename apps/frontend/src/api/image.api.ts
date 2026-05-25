/**
 * 图片 API
 * by AI.Coding
 */
import type { AxiosRequestConfig } from 'axios'
import type { ImageUploadResult } from '@app/shared'
import { http } from './http'

export const imageApi = {
  /** 上传图片；docId 可选（不传则不关联文档） */
  upload(file: File, docId?: number) {
    const fd = new FormData()
    fd.append('file', file)
    const config: AxiosRequestConfig | undefined = docId
      ? { params: { docId } }
      : undefined
    return http.post<ImageUploadResult>('/images', fd, config)
  },
}
