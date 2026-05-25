/**
 * 审计日志 API（仅 ADMIN 可调用）
 * by AI.Coding
 */
import type { AuditPage, AuditQuery } from '@app/shared'
import { http } from './http'

export const auditApi = {
  list(query: Partial<AuditQuery> = {}) {
    return http.get<AuditPage>(`/admin/audit`, { params: query })
  },
}
