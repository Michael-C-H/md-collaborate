/**
 * Snapshot controller
 * by AI.Coding
 *
 * GET    /api/docs/:docId/snapshots                     列出全部快照
 * GET    /api/docs/:docId/snapshots/:versionNo          获取某版本完整内容
 * POST   /api/docs/:docId/snapshots                     手动创建快照
 * POST   /api/docs/:docId/snapshots/:versionNo/restore  恢复到该版本
 */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common'
import {
  CreateSnapshotSchema,
  RestoreSnapshotSchema,
  type CreateSnapshotDto,
  type RestoreSnapshotDto,
} from '@app/shared'
import { ok } from '../common/api-result'
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { PermissionGuard } from '../permission/permission.guard'
import { RequirePermission } from '../permission/require-permission.decorator'
import { SnapshotService } from './snapshot.service'

@Controller('docs/:docId/snapshots')
@UseGuards(PermissionGuard)
export class SnapshotController {
  constructor(private readonly service: SnapshotService) {}

  @Get()
  @RequirePermission('READ', 'docId')
  async list(
    @Param('docId', ParseIntPipe) docId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ok(await this.service.list(user.userId, user.role === 'ADMIN', docId))
  }

  @Get(':versionNo')
  @RequirePermission('READ', 'docId')
  async get(
    @Param('docId', ParseIntPipe) docId: number,
    @Param('versionNo', ParseIntPipe) versionNo: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ok(await this.service.get(user.userId, user.role === 'ADMIN', docId, versionNo))
  }

  @Post()
  @RequirePermission('WRITE', 'docId')
  async create(
    @Param('docId', ParseIntPipe) docId: number,
    @Body(new ZodValidationPipe(CreateSnapshotSchema)) dto: CreateSnapshotDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ok(await this.service.createManual(user.userId, user.role === 'ADMIN', docId, dto))
  }

  @Post(':versionNo/restore')
  @RequirePermission('WRITE', 'docId')
  async restore(
    @Param('docId', ParseIntPipe) docId: number,
    @Param('versionNo', ParseIntPipe) versionNo: number,
    @Body(new ZodValidationPipe(RestoreSnapshotSchema)) dto: RestoreSnapshotDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return ok(
      await this.service.restore(user.userId, user.role === 'ADMIN', docId, versionNo, dto.force),
    )
  }
}
