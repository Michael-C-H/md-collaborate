/**
 * Snapshot 模块
 * by AI.Coding
 */
import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { CollabModule } from '../collab/collab.module'
import { PermissionModule } from '../permission/permission.module'
import { AutoSnapshotJob } from './jobs/auto-snapshot.job'
import { CleanupJob } from './jobs/cleanup.job'
import { SnapshotController } from './snapshot.controller'
import { SnapshotRepo } from './snapshot.repo'
import { SnapshotService } from './snapshot.service'

@Module({
  imports: [PermissionModule, CollabModule, AuditModule],
  controllers: [SnapshotController],
  providers: [SnapshotRepo, SnapshotService, AutoSnapshotJob, CleanupJob],
  exports: [SnapshotService],
})
export class SnapshotModule {}
