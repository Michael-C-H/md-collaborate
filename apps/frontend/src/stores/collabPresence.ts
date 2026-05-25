/**
 * 协同在线用户 Pinia store
 * by AI.Coding
 *
 * 通过 yjs awareness 拿到当前文档的所有在线协作者（含自己）。
 * 数据由 EditorShell 在 provider 建立后写入。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface CollabPresence {
  /** awareness clientId，作为唯一 key */
  clientId: number
  userId: number
  name: string
  color: string
}

export const useCollabPresenceStore = defineStore('collabPresence', () => {
  /** 当前打开文档的在线协作者（含自己） */
  const presences = ref<CollabPresence[]>([])
  /** 当前 ws 连接状态 */
  const connectionStatus = ref<string>('disconnected')
  /** 是否处于 readOnly（后端判定） */
  const readOnly = ref(false)

  function setPresences(list: CollabPresence[]): void {
    presences.value = list
  }

  function setStatus(status: string): void {
    connectionStatus.value = status
  }

  function setReadOnly(v: boolean): void {
    readOnly.value = v
  }

  function reset(): void {
    presences.value = []
    connectionStatus.value = 'disconnected'
    readOnly.value = false
  }

  return { presences, connectionStatus, readOnly, setPresences, setStatus, setReadOnly, reset }
})
