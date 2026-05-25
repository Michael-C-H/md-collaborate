<script setup lang="ts">
/**
 * 顶栏：左侧 Logo，右侧入口（回收站 / 日志）+ 主题切换 + 当前用户 + 登出
 * by AI.Coding
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  BulbFilled,
  BulbOutlined,
  DeleteOutlined,
  DesktopOutlined,
  FileSearchOutlined,
  LogoutOutlined,
} from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useCurrentUserStore } from '@/stores/currentUser'
import { useThemeStore, type ThemeMode } from '@/stores/theme'

const store = useCurrentUserStore()
const themeStore = useThemeStore()
const router = useRouter()
const isAdmin = computed(() => store.user?.role === 'ADMIN')

const themeIcon = computed(() => {
  if (themeStore.mode === 'dark') return BulbOutlined
  if (themeStore.mode === 'light') return BulbFilled
  return DesktopOutlined
})

function setTheme(mode: ThemeMode): void {
  themeStore.setMode(mode)
}

async function onLogout(): Promise<void> {
  const redirect = await store.logout()
  if (redirect) {
    window.location.href = redirect
  } else {
    window.location.href = '/'
  }
}

function goTrash(): void {
  void router.push({ name: 'trash' })
}
function goAudit(): void {
  void router.push({ name: 'admin-audit' })
}
</script>

<template>
  <header class="topbar">
    <div class="brand">md-collab</div>
    <a-space v-if="store.user" :size="12" align="center">
      <a-button @click="goTrash">
        <template #icon><DeleteOutlined /></template>
        回收站
      </a-button>
      <a-button v-if="isAdmin" @click="goAudit">
        <template #icon><FileSearchOutlined /></template>
        操作日志
      </a-button>

      <a-dropdown :trigger="['click']">
        <a-tooltip
          :title="
            themeStore.mode === 'light'
              ? '主题：亮色'
              : themeStore.mode === 'dark'
                ? '主题：暗色'
                : '主题：跟随系统'
          "
        >
          <a-button>
            <template #icon><component :is="themeIcon" /></template>
          </a-button>
        </a-tooltip>
        <template #overlay>
          <a-menu :selected-keys="[themeStore.mode]" @click="(e) => setTheme(e.key as ThemeMode)">
            <a-menu-item key="light">
              <BulbFilled /> 亮色
            </a-menu-item>
            <a-menu-item key="dark">
              <BulbOutlined /> 暗色
            </a-menu-item>
            <a-menu-item key="auto">
              <DesktopOutlined /> 跟随系统
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>

      <UserAvatar :user-id="store.user.userId" :name="store.user.displayName" :size="32" />
      <span class="name">{{ store.user.displayName }}</span>
      <a-button type="text" @click="onLogout">
        <template #icon><LogoutOutlined /></template>
        登出
      </a-button>
    </a-space>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex: 0 0 auto;
}
.brand {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-primary);
}
.name {
  font-size: 0.9rem;
  color: var(--text-primary);
}
</style>
