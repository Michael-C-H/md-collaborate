/**
 * Permission controller
 * by AI.Coding
 *
 * GET    /api/nodes/:id/permissions               协作者列表 — 仅 MANAGE / ADMIN
 * PUT    /api/nodes/:id/permissions/:userId       授权 / 改权限
 * DELETE /api/nodes/:id/permissions/:userId       撤权
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common'
import { GrantPermissionSchema, type GrantPermissionDto } from '@app/shared'
import { ok } from '../common/api-result'
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator'
import { BadRequestException } from '../common/exceptions/app.exception'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { PermissionGuard } from './permission.guard'
import { RequirePermission } from './require-permission.decorator'
import { PermissionService } from './permission.service'

@Controller('nodes/:id/permissions')
@UseGuards(PermissionGuard)
export class PermissionController {
  constructor(private readonly service: PermissionService) {}

  /** 协作者列表 */
  @Get()
  @RequirePermission('MANAGE')
  async list(@Param('id', ParseIntPipe) nodeId: number) {
    const list = await this.service.listCollaborators(nodeId)
    return ok(list)
  }

  /** 授权 / 改权限 */
  @Put(':userId')
  @RequirePermission('MANAGE')
  async grant(
    @Param('id', ParseIntPipe) nodeId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body(new ZodValidationPipe(GrantPermissionSchema)) body: GrantPermissionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequestException('userId 不合法')
    }
    const granted = await this.service.grant(user.userId, nodeId, userId, body.role)
    return ok(granted)
  }

  /** 撤权 */
  @Delete(':userId')
  @RequirePermission('MANAGE')
  async revoke(
    @Param('id', ParseIntPipe) nodeId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() current: CurrentUserPayload,
  ) {
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequestException('userId 不合法')
    }
    await this.service.revoke(current.userId, nodeId, userId)
    return ok(null)
  }
}
