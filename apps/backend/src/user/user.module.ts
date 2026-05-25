/**
 * User 模块
 * by AI.Coding
 *
 * 导出 KnownUserService（用于 AuthModule 在 SSO 登录时 upsert）
 * 和 KnownUserRepo（用于 PermissionService 关联 displayName / username）
 */
import { Module } from '@nestjs/common'
import { KnownUserRepo } from './known-user.repo'
import { KnownUserService } from './user.service'
import { UserController } from './user.controller'

@Module({
  controllers: [UserController],
  providers: [KnownUserService, KnownUserRepo],
  exports: [KnownUserService, KnownUserRepo],
})
export class UserModule {}
