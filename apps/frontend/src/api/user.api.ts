/**
 * 用户检索 API 封装
 * by AI.Coding
 */
import type { KnownUserVO } from '@app/shared'
import { http } from './http'

export const userApi = {
  /** GET /api/users/search?q=&limit= — 模糊检索 */
  search: (q: string, limit = 20) =>
    http.get<KnownUserVO[]>('/users/search', { params: { q, limit } }),

  /** GET /api/users/by-username/:username — 精确查询 */
  byUsername: (username: string) =>
    http.get<KnownUserVO>(`/users/by-username/${encodeURIComponent(username)}`),
}
