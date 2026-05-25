/**
 * Collab 模块
 * by AI.Coding
 */
import { Module } from '@nestjs/common'
import { PermissionModule } from '../permission/permission.module'
import { CollabInitializer } from './collab.initializer'
import { HocuspocusFactory } from './hocuspocus.factory'
import { PresenceService } from './presence.service'

@Module({
  imports: [PermissionModule],
  providers: [PresenceService, HocuspocusFactory, CollabInitializer],
  // 导出 PresenceService（编辑者计数）和 HocuspocusFactory（用于版本恢复时直接操作 doc）
  exports: [PresenceService, HocuspocusFactory],
})
export class CollabModule {}
