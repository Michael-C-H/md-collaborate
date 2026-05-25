/**
 * 业务异常体系
 * by AI.Coding
 *
 * 所有业务异常都继承自 AppException，统一被 AppExceptionFilter 捕获转为 ApiResult。
 * 业务代码不要直接 throw new Error，应当选择合适的子类。
 */
import { HttpException, HttpStatus } from '@nestjs/common'

/**
 * 业务异常基类。
 *
 * @param code        业务错误码（前端可据此做精细处理）
 * @param message     给用户看的中文文案
 * @param statusCode  HTTP 状态码（默认 400）
 */
export class AppException extends HttpException {
  readonly code: number

  constructor(code: number, message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message, statusCode)
    this.code = code
  }
}

/** 参数不合法 / 数据非法 → 400 */
export class BadRequestException extends AppException {
  constructor(message = '请求参数不合法') {
    super(400, message, HttpStatus.BAD_REQUEST)
  }
}

/** 未登录 / 会话失效 → 401 */
export class AuthException extends AppException {
  constructor(message = '请先登录') {
    super(401, message, HttpStatus.UNAUTHORIZED)
  }
}

/** 权限不足 → 403 */
export class ForbiddenException extends AppException {
  constructor(message = '没有权限执行该操作') {
    super(403, message, HttpStatus.FORBIDDEN)
  }
}

/** 资源不存在 → 404 */
export class NotFoundException extends AppException {
  constructor(message = '资源不存在') {
    super(404, message, HttpStatus.NOT_FOUND)
  }
}

/**
 * 业务冲突 → 409
 *
 * 例如：单文档手动快照达到上限、版本恢复时仍有在线编辑者等。
 * 允许携带 data 让前端做进一步交互（如"覆盖 N 人编辑"提示）。
 */
export class ConflictException extends AppException {
  readonly extraData: unknown

  constructor(message = '请求冲突', extraData: unknown = null) {
    super(409, message, HttpStatus.CONFLICT)
    this.extraData = extraData
  }
}
