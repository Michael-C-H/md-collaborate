/**
 * 审计模块
 * by AI.Coding
 *
 * 导出 AuditService 给其他模块在业务流程内显式记录日志。
 */
import { Module } from '@nestjs/common'
import { AuditController } from './audit.controller'
import { AuditRepo } from './audit.repo'
import { AuditService } from './audit.service'

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepo],
  exports: [AuditService],
})
export class AuditModule {}
