/**
 * 当前登录用户 Pinia store
 * by AI.Coding
 *
 * - load()：调用 /api/auth/me；成功写入 user，失败置为 null；loaded 标记为 true
 * - logout()：调用 /api/auth/logout，清空 user，返回跳转地址（SSO 用户）或 null（LOCAL 用户）
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CurrentUser } from '@app/shared'
import { authApi } from '@/api/auth.api'

export const useCurrentUserStore = defineStore('currentUser', () => {
  const user = ref<CurrentUser | null>(null)
  /** 是否已尝试加载过；用于避免重复请求 */
  const loaded = ref(false)

  async function load(): Promise<CurrentUser | null> {
    try {
      const res = await authApi.me()
      user.value = res.code === 0 && res.data ? res.data : null
    } catch {
      // 401 / 网络异常都视为未登录
      user.value = null
    }
    loaded.value = true
    return user.value
  }

  async function logout(): Promise<string | null> {
    try {
      const res = await authApi.logout()
      user.value = null
      return res.code === 0 && res.data ? res.data.redirectUrl : null
    } catch {
      user.value = null
      return null
    }
  }

  return { user, loaded, load, logout }
})
