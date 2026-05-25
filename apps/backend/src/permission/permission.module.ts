/**
 * Permission 模块
 * by AI.Coding
 *
 * 单向依赖：
 *   NodeModule  →  PermissionModule   (NodeService 调用 PermissionService 校验)
 *   PermissionModule 不反向 import NodeModule（Guard 通过 drizzle 直查 nodes 表）
 */
import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { UserModule } from '../user/user.module'
import { PermissionController } from './permission.controller'
import { PermissionGuard } from './permission.guard'
import { PermissionRepo } from './permission.repo'
import { PermissionService } from './permission.service'

@Module({
  imports: [UserModule, AuditModule],
  controllers: [PermissionController],
  providers: [PermissionRepo, PermissionService, PermissionGuard],
  exports: [PermissionRepo, PermissionService, PermissionGuard],
})
export class PermissionModule {}
