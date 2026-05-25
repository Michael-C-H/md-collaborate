/**
 * 回收站 controller
 * by AI.Coding
 *
 * GET    /api/trash                 列出回收站（scope=mine|all）
 * POST   /api/trash/:nodeId/restore 恢复节点（及子树）
 * DELETE /api/trash/:nodeId         彻底删除节点（必须带 ?confirm=YES）
 */
import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common'
import {
  PURGE_CONFIRM_TOKEN,
  TrashListQuerySchema,
  type TrashListQuery,
} from '@app/shared'
import { ok } from '../common/api-result'
import { BadRequestException } from '../common/exceptions/app.exception'
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { TrashService } from './trash.service'

@Controller('trash')
export class TrashController {
  constructor(private readonly service: TrashService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(TrashListQuerySchema)) query: TrashListQuery,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const items = await this.service.list(user.userId, user.role === 'ADMIN', query)
    return ok({ items })
  }

  @Post(':nodeId/restore')
  async restore(
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const data = await this.service.restore(user.userId, user.role === 'ADMIN', nodeId)
    return ok(data)
  }

  @Delete(':nodeId')
  async purge(
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Query('confirm') confirm: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (confirm !== PURGE_CONFIRM_TOKEN) {
      throw new BadRequestException(
        `彻底删除需带 ?confirm=${PURGE_CONFIRM_TOKEN} 以避免误操作`,
      )
    }
    const data = await this.service.purge(user.userId, user.role === 'ADMIN', nodeId)
    return ok(data)
  }
}
