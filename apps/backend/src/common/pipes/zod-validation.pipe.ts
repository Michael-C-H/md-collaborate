/**
 * Zod 参数校验管道
 * by AI.Coding
 *
 * 用法：
 *   @Post()
 *   @UsePipes(new ZodValidationPipe(CreateNodeSchema))
 *   create(@Body() body: CreateNodeDto) { ... }
 *
 * 入参解析失败时抛 BadRequestException，由全局过滤器转为 ApiResult { code: 400 }。
 */
import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common'
import { ZodError, type ZodSchema } from 'zod'
import { BadRequestException } from '../exceptions/app.exception'

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    // 仅校验 body / query / param，跳过自定义装饰器参数
    if (metadata.type !== 'body' && metadata.type !== 'query' && metadata.type !== 'param') {
      return value as T
    }
    const result = this.schema.safeParse(value)
    if (result.success) {
      return result.data
    }
    // 取第一条错误作为给前端的提示，保持简洁
    const first = result.error.errors[0]
    const path = first?.path?.join('.') ?? ''
    const message = first?.message ?? '参数不合法'
    throw new BadRequestException(path ? `${path}: ${message}` : message)
  }
}
