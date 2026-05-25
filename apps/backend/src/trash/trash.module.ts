/**
 * 回收站模块
 * by AI.Coding
 */
import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { ImageModule } from '../image/image.module'
import { NodeModule } from '../node/node.module'
import { TrashController } from './trash.controller'
import { TrashPurgeJob } from './trash-purge.job'
import { TrashRepo } from './trash.repo'
import { TrashService } from './trash.service'

@Module({
  imports: [NodeModule, ImageModule, AuditModule],
  controllers: [TrashController],
  providers: [TrashService, TrashRepo, TrashPurgeJob],
  exports: [TrashService],
})
export class TrashModule {}
