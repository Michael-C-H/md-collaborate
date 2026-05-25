/**
 * 回收站 API
 * by AI.Coding
 */
import type { TrashItemVO } from '@app/shared'
import { http } from './http'

export const trashApi = {
  list(scope: 'mine' | 'all' = 'mine') {
    return http.get<{ items: TrashItemVO[] }>(`/trash`, { params: { scope } })
  },
  restore(nodeId: number) {
    return http.post<{ id: number; parentId: number | null }>(`/trash/${nodeId}/restore`)
  },
  /** 彻底删除：必须带 confirm=YES */
  purge(nodeId: number) {
    return http.delete<{ purgedNodeCount: number; purgedImageCount: number }>(
      `/trash/${nodeId}`,
      { params: { confirm: 'YES' } },
    )
  },
}
