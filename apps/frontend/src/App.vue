<script setup lang="ts">
/**
 * 应用根组件
 * by AI.Coding
 *
 * 整树外包 a-config-provider：
 *   - locale 走中文
 *   - theme 切换走 themeStore.applied：darkAlgorithm 或 defaultAlgorithm
 *
 * 主题副作用（html[data-theme] 切换）由 themeStore 自己 watch 写入。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { theme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import AppTopBar from '@/components/AppTopBar.vue'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const showTopBar = computed(() => route.meta['requiresAuth'] !== false)

const themeStore = useThemeStore()
const adTheme = computed(() => ({
  algorithm:
    themeStore.applied === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    // 微调与品牌色保持一致
    colorPrimary: '#1f77b4',
  },
}))
</script>

<template>
  <a-config-provider :locale="zhCN" :theme="adTheme">
    <div class="app-root">
      <AppTopBar v-if="showTopBar" />
      <main class="app-main">
        <RouterView />
      </main>
    </div>
  </a-config-provider>
</template>

<style>
:root {
  /* 亮色 token 集，供手写 scoped 样式使用 */
  --bg-primary: #ffffff;
  --bg-secondary: #fafafa;
  --bg-tertiary: #f5f5f5;
  --bg-hover: #f0f6fb;
  --bg-active: #e8f0f8;
  --text-primary: #222222;
  --text-secondary: #555555;
  --text-tertiary: #888888;
  --text-muted: #aaaaaa;
  --border-color: #e6e6e6;
  --border-strong: #d0d0d0;
  --shadow-card: 0 12px 32px rgba(0, 0, 0, 0.18);
  /* 滚动条 token */
  --scrollbar-track: transparent;
  --scrollbar-thumb: #c8c8c8;
  --scrollbar-thumb-hover: #a0a0a0;
  color-scheme: light;
}

[data-theme='dark'] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #232323;
  --bg-tertiary: #2a2a2a;
  --bg-hover: #2e3a47;
  --bg-active: #233649;
  --text-primary: #e6e6e6;
  --text-secondary: #b5b5b5;
  --text-tertiary: #8a8a8a;
  --text-muted: #5e5e5e;
  --border-color: #303030;
  --border-strong: #404040;
  --shadow-card: 0 12px 32px rgba(0, 0, 0, 0.45);
  --scrollbar-track: transparent;
  --scrollbar-thumb: #3f3f3f;
  --scrollbar-thumb-hover: #555555;
  color-scheme: dark;
}

/* Firefox：thin + 主题色二元组 */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

/* WebKit / Chromium：自定义滚动条 */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
  background-clip: content-box;
  border: 2px solid transparent;
}
::-webkit-scrollbar-corner {
  background: transparent;
}

html,
body,
#app,
.app-root {
  height: 100%;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.18s ease, color 0.18s ease;
}
.app-root {
  display: flex;
  flex-direction: column;
}
.app-main {
  flex: 1 1 auto;
  overflow: auto;
}
</style>