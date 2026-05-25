/**
 * 后端 ApiResult 包装工具
 * by AI.Coding
 *
 * 与 @app/shared/ApiResult 保持结构一致；这里只是给业务代码提供便利的构造函数。
 */
import { ApiCode, type ApiResult } from '@app/shared'

/** 构造业务成功返回 */
export function ok<T>(data: T, message = 'ok'): ApiResult<T> {
  return { code: ApiCode.OK, message, data }
}

/** 构造业务失败返回（一般由 AppExceptionFilter 自动构造，业务代码很少手动调用） */
export function fail(code: number, message: string, data: unknown = null): ApiResult {
  return { code, message, data: data as null }
}
