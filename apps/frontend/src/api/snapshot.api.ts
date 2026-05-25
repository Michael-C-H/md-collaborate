/**
 * 版本快照 API
 * by AI.Coding
 */
import type {
  CreateSnapshotDto,
  RestoreConflictData,
  RestoreSnapshotDto,
  SnapshotContentVO,
  SnapshotVO,
} from '@app/shared'
import { http } from './http'

export const snapshotApi = {
  list(docId: number) {
    return http.get<SnapshotVO[]>(`/docs/${docId}/snapshots`)
  },
  get(docId: number, versionNo: number) {
    return http.get<SnapshotContentVO>(`/docs/${docId}/snapshots/${versionNo}`)
  },
  create(docId: number, body: CreateSnapshotDto) {
    return http.post<SnapshotVO>(`/docs/${docId}/snapshots`, body)
  },
  /** 恢复；失败 code=409 时 res.data 携带 editorCount */
  restore(docId: number, versionNo: number, body: RestoreSnapshotDto) {
    return http.post<SnapshotVO | RestoreConflictData>(
      `/docs/${docId}/snapshots/${versionNo}/restore`,
      body,
    )
  },
}
