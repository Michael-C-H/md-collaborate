/**
 * SSO 验证失败异常
 * by AI.Coding
 *
 * 三方 SSO verify 接口失败时（如 TOKEN_CONSUMED、TOKEN_EXPIRED、INVALID_TOKEN）抛出。
 * SsoTokenMiddleware 捕获后会 302 到 /login-error?code=<errorCode>。
 *
 * 不继承 AppException，因为它不应被 AppExceptionFilter 包装成 ApiResult；
 * SSO 失败的场景是浏览器直接跳转用户。
 */
export class SsoVerifyException extends Error {
  readonly errorCode: string
  readonly httpStatus: number

  constructor(errorCode: string, message: string, httpStatus = 401) {
    super(message)
    this.name = 'SsoVerifyException'
    this.errorCode = errorCode
    this.httpStatus = httpStatus
  }
}
