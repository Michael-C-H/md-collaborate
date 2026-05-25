/**
 * 主题模式 Pinia store
 * by AI.Coding
 *
 * 三档模式：
 *   - light  显式亮色
 *   - dark   显式暗色
 *   - auto   跟随系统 (prefers-color-scheme: dark)
 *
 * 用户选择持久化到 localStorage('md-collab.theme')；首次访问默认 auto。
 *
 * 副作用：
 *   - 把 applied (实际生效的 light/dark) 写到 <html data-theme="...">
 *     全局 CSS 通过 [data-theme=dark] 切换 CSS 变量
 *   - 监听 system 变化（仅 auto 模式下生效）
 */
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type ThemeApplied = 'light' | 'dark'

const STORAGE_KEY = 'md-collab.theme'

function readSaved(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'auto'
  const v = localStorage.getItem(STORAGE_KEY)
  if (v === 'light' || v === 'dark' || v === 'auto') return v
  return 'auto'
}

function querySystemPref(): ThemeApplied {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readSaved())
  const systemPref = ref<ThemeApplied>(querySystemPref())

  /** 实际生效的主题（auto 时跟随系统） */
  const applied = computed<ThemeApplied>(() =>
    mode.value === 'auto' ? systemPref.value : mode.value,
  )

  function setMode(next: ThemeMode): void {
    mode.value = next
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next)
    }
  }

  // 应用到 html[data-theme]，全局 CSS 变量切换
  watch(
    applied,
    (v) => {
      if (typeof document !== 'undefined') {
        document.documentElement.dataset['theme'] = v
      }
    },
    { immediate: true },
  )

  // 监听系统配色变化（仅 auto 模式下会反映出来）
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent): void => {
      systemPref.value = e.matches ? 'dark' : 'light'
    }
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
  }

  return { mode, applied, setMode }
})
