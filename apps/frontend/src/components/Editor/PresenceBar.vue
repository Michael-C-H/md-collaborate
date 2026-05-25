<script setup lang="ts">
/**
 * 在线协作者头像列表
 * by AI.Coding
 *
 * 数据来源：useCollabPresenceStore.presences（由 EditorShell 写入）。
 */
import { computed } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useCollabPresenceStore } from '@/stores/collabPresence'

const store = useCollabPresenceStore()

const statusText = computed(() => {
  switch (store.connectionStatus) {
    case 'connected':
      return store.readOnly ? '已连接（只读）' : '已连接'
    case 'connecting':
      return '连接中 …'
    case 'disconnected':
      return '已断开'
    default:
      return store.connectionStatus
  }
})

const statusClass = computed(() => {
  if (store.connectionStatus === 'connected') return store.readOnly ? 'warn' : 'ok'
  return 'warn'
})
</script>

<template>
  <div class="presence-bar">
    <div class="users">
      <UserAvatar
        v-for="p in store.presences"
        :key="p.clientId"
        :user-id="p.userId"
        :name="p.name"
        :size="28"
      />
      <span v-if="store.presences.length === 0" class="hint">暂无协作者</span>
    </div>
    <span class="status" :class="statusClass">{{ statusText }}</span>
  </div>
</template>

<style scoped>
.presence-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.users {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.hint {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}
.status {
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
}
.status.ok {
  background: #e7f5ee;
  color: #2a7a4a;
}
.status.warn {
  background: #fff4d6;
  color: #aa6f00;
}
[data-theme='dark'] .status.ok {
  background: #1f3a2c;
  color: #6fd6a0;
}
[data-theme='dark'] .status.warn {
  background: #3a2f1a;
  color: #e3b76a;
}
</style>
