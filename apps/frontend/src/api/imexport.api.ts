/**
 * 导入导出 API
 * by AI.Coding
 */
import type { ImportResult } from '@app/shared'
import { http } from './http'

export const imexportApi = {
  importMd(file: File, parentId?: number | null) {
    const fd = new FormData()
    fd.append('file', file)
    if (parentId) fd.append('parentId', String(parentId))
    return http.post<ImportResult>('/imports/md', fd)
  },
  importZip(file: File, parentId?: number | null) {
    const fd = new FormData()
    fd.append('file', file)
    if (parentId) fd.append('parentId', String(parentId))
    return http.post<ImportResult>('/imports/zip', fd)
  },
  /** 直接拼 URL 让浏览器触发下载（无需 axios，避免 blob 转换开销） */
  exportMdUrl(docId: number): string {
    return `/api/docs/${docId}/export-md`
  },
  exportPdfUrl(docId: number): string {
    return `/api/docs/${docId}/export-pdf`
  },
}
