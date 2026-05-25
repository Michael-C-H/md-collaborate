/**
 * HTTP 客户端
 * by AI.Coding
 *
 * 设计要点：
 *   - 底层用 axios，但**类型层**把响应直接对齐到 ApiResult：
 *     调用方写 `await http.get<User>('/users/me')` 直接拿到 `ApiResult<User>`，
 *     不需要再 `.data.data.xxx`。
 *   - validateStatus：HTTP 4xx 也视为"业务错误"，由 ApiResult.code 表达，
 *     让调用方用 `if (res.code === 0)` 统一处理成功/失败，能拿到后端 message。
 *     仅 5xx 走 axios 的 reject 分支（视作网络层/服务异常）。
 *   - 自动带 cookie（iron-session 用）；统一 /api 前缀（vite proxy 或 Nginx 转发）。
 */
import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import type { ApiResult } from '@app/shared'

const baseURL = import.meta.env.VITE_API_BASE ?? '/api'

const instance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30_000,
  // 4xx 仍解析为正常响应（ApiResult），5xx 才 reject
  validateStatus: (status) => status < 500,
})

instance.interceptors.response.use(
  (resp) => resp.data,
  (err: AxiosError<ApiResult>) => Promise.reject(err),
)

/**
 * typed HTTP 客户端
 *
 * 用法：
 *   const res = await http.get<UserVO>('/users/me')
 *   if (res.code === 0) 用 res.data
 *   else                显示 res.message
 *
 * 注意：5xx / 网络错误仍会抛 axios 异常，调用方应当 try/catch。
 */
export const http = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    instance.get(url, config) as unknown as Promise<ApiResult<T>>,
  post: <T = unknown>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    instance.post(url, body, config) as unknown as Promise<ApiResult<T>>,
  put: <T = unknown>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    instance.put(url, body, config) as unknown as Promise<ApiResult<T>>,
  patch: <T = unknown>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    instance.patch(url, body, config) as unknown as Promise<ApiResult<T>>,
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    instance.delete(url, config) as unknown as Promise<ApiResult<T>>,
}
