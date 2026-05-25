/**
 * 全局异常过滤器：所有异常都转成 ApiResult 返回
 * by AI.Coding
 *
 * 优先级：
 *   1) AppException     → 用其 code / message / status
 *   2) HttpException    → NestJS 内置异常（如 ValidationPipe 抛的）
 *   3) 其他未知异常     → 500，记录日志、不向客户端暴露细节
 */
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'
import { Logger } from 'nestjs-pino'
import { fail } from '../api-result'
import { AppException, ConflictException } from '../exceptions/app.exception'

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    // 1) 业务异常
    if (exception instanceof AppException) {
      // ConflictException 可能带 extraData（如 editorCount），透传给前端
      const data = exception instanceof ConflictException ? exception.extraData : null
      response.status(exception.getStatus()).json(fail(exception.code, exception.message, data))
      return
    }

    // 2) NestJS 内置 HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      const rawMessage =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message)
      const message = Array.isArray(rawMessage) ? rawMessage.join('；') : (rawMessage as string)
      response.status(status).json(fail(status, message))
      return
    }

    // 3) 未识别异常 → 500
    this.logger.error({ err: exception }, '未处理的异常')
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(fail(500, '服务异常，请稍后重试'))
  }
}
