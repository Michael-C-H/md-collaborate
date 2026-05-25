/**
 * Permission API 封装
 * by AI.Coding
 */
import type { GrantPermissionDto, PermissionRole, PermissionVO } from '@app/shared'
import { http } from './http'

export const permissionApi = {
  /** GET /api/nodes/:nodeId/permissions */
  list: (nodeId: number) =>
    http.get<PermissionVO[]>(`/nodes/${nodeId}/permissions`),

  /** PUT /api/nodes/:nodeId/permissions/:userId */
  grant: (nodeId: number, userId: number, role: PermissionRole) =>
    http.put<PermissionVO>(`/nodes/${nodeId}/permissions/${userId}`, {
      role,
    } satisfies GrantPermissionDto),

  /** DELETE /api/nodes/:nodeId/permissions/:userId */
  revoke: (nodeId: number, userId: number) =>
    http.delete<null>(`/nodes/${nodeId}/permissions/${userId}`),
}
