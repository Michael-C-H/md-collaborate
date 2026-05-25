/**
 * 统一 API 返回结构
 * by AI.Coding
 *
 * 后端所有 HTTP 接口在正常 / 业务错误两种情况下都返回 ApiResult。
 * 框架性错误（401/403/404/500）由 AppExceptionFilter 自动包装。
 */

/** 通用返回结构 */
export interface ApiResult<T = unknown> {
  /** 0 表示业务成功；非 0 表示业务错误码（与 HTTP 状态码可能一致也可能不一致） */
  code: number
  /** 给前端展示用的文案 */
  message: string
  /** 业务数据，错误时通常为 null */
  data: T | null
}

/** 业务错误码常量 — 与 HTTP 状态码区分，但目前 MVP 对齐到 HTTP */
export const ApiCode = {
  OK: 0,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const

export type ApiCodeValue = (typeof ApiCode)[keyof typeof ApiCode]
