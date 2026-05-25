/**
 * Node 模块
 * by AI.Coding
 *
 * NodeService 依赖 PermissionService / PermissionRepo（来自 PermissionModule）
 */
import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { PermissionModule } from '../permission/permission.module'
import { DocContentController } from './doc-content.controller'
import { NodeController } from './node.controller'
import { NodeRepo } from './node.repo'
import { NodeService } from './node.service'
import { NodePathHelper } from './path-helper'

@Module({
  imports: [PermissionModule, AuditModule],
  controllers: [NodeController, DocContentController],
  providers: [NodeRepo, NodeService, NodePathHelper],
  exports: [NodeRepo, NodeService, NodePathHelper],
})
export class NodeModule {}
