/**
 * 审计查询接口（仅 ADMIN）
 * by AI.Coding
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuditQuerySchema, type AuditQuery } from '@app/shared'
import { ok } from '../common/api-result'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { AdminGuard } from '../common/guards/admin.guard'
import { AuditService } from './audit.service'

@Controller('admin/audit')
@UseGuards(AdminGuard)
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(AuditQuerySchema)) q: AuditQuery) {
    const page = await this.service.query(q)
    return ok(page)
  }
}
