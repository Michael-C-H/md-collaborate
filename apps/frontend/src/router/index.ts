/**
 * 路由配置 + 会话守卫
 * by AI.Coding
 *
 * 守卫顺序：
 *   1) 公开路由（meta.requiresAuth === false）直接放行
 *   2) URL 上带 ssoToken → 调 /api/auth/sso-login 换会话；成功后去掉参数继续，失败跳登录失败页
 *   3) 已有会话直接放行；无会话跳 /login-error?code=NO_SESSION
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { CurrentUser, SsoLoginErrorData } from '@app/shared'
import { authApi } from '@/api/auth.api'
import { useCurrentUserStore } from '@/stores/currentUser'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/trash',
    name: 'trash',
    component: () => import('@/views/TrashView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/audit',
    name: 'admin-audit',
    component: () => import('@/views/AuditView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login-error',
    name: 'login-error',
    component: () => import('@/views/LoginErrorView.vue'),
    meta: { requiresAuth: false },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  // ─ 公开路由 ─
  if (to.meta['requiresAuth'] === false) {
    return true
  }

  const store = useCurrentUserStore()

  // ─ URL 上带 ssoToken：优先用它换会话 ─
  const ssoToken = typeof to.query['ssoToken'] === 'string' ? to.query['ssoToken'] : null
  if (ssoToken) {
    const res = await authApi.ssoLogin(ssoToken)
    if (res.code === 0 && res.data) {
      store.user = res.data as CurrentUser
      store.loaded = true
      // 去掉 URL 上的 ssoToken 参数，避免刷新页面又触发一次（一次性 token）
      const cleanedQuery = { ...to.query }
      delete cleanedQuery['ssoToken']
      return { path: to.path, query: cleanedQuery, replace: true }
    }
    // 失败 → 跳 /login-error，code 取自后端
    const errorCode =
      (res.data as SsoLoginErrorData | null)?.errorCode ?? 'UNKNOWN'
    return { name: 'login-error', query: { code: errorCode } }
  }

  // ─ 常规：已有会话直接通过 ─
  if (!store.loaded) {
    await store.load()
  }
  if (!store.user) {
    return { name: 'login-error', query: { code: 'NO_SESSION' } }
  }
  return true
})
