/**
 * 管理员 API 封装
 * by AI.Coding
 */
import type { AdminUserList, CreateUserRequest, KnownUserVO, UpdateUserRequest } from '@app/shared'
import { http } from './http'

export const adminApi = {
  /** GET /api/admin/users — 用户列表（分页） */
  listUsers: (page = 1, pageSize = 20, keyword?: string) =>
    http.get<AdminUserList>('/admin/users', { params: { page, pageSize, keyword } }),

  /** POST /api/admin/users — 创建用户 */
  createUser: (data: CreateUserRequest) =>
    http.post<KnownUserVO>('/admin/users', data),

  /** PATCH /api/admin/users/:id — 修改用户 */
  updateUser: (id: number, data: UpdateUserRequest) =>
    http.patch<KnownUserVO>(`/admin/users/${id}`, data),

  /** DELETE /api/admin/users/:id — 删除用户 */
  deleteUser: (id: number) =>
    http.delete<null>(`/admin/users/${id}`),
}
