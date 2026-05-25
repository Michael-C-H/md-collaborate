/**
 * Node API 封装
 * by AI.Coding
 */
import type { CreateNodeDto, DocContent, NodeTreeVO, NodeVO, TreesResponse, UpdateNodeDto } from '@app/shared'
import { http } from './http'

export const nodeApi = {
  /** GET /api/nodes/tree */
  tree: () => http.get<NodeTreeVO[]>('/nodes/tree'),
  /** GET /api/nodes/trees（双树：我的 + 共享） */
  trees: () => http.get<TreesResponse>('/nodes/trees'),
  /** GET /api/nodes/:id */
  detail: (id: number) => http.get<NodeVO>(`/nodes/${id}`),
  /** POST /api/nodes */
  create: (body: CreateNodeDto) => http.post<NodeVO>('/nodes', body),
  /** PATCH /api/nodes/:id */
  update: (id: number, body: UpdateNodeDto) => http.patch<NodeVO>(`/nodes/${id}`, body),
  /** DELETE /api/nodes/:id（软删） */
  remove: (id: number) => http.delete<null>(`/nodes/${id}`),
  /** GET /api/docs/:id/content */
  content: (id: number) => http.get<DocContent>(`/docs/${id}/content`),
}
