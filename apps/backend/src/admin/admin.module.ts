/**
 * Admin 模块
 * by AI.Coding
 *
 * 提供管理员专属的用户管理功能。
 */
import { Module } from '@nestjs/common'
import { UserModule } from '../user/user.module'
import { AuthModule } from '../auth/auth.module'
import { AdminUserController } from './admin-user.controller'

@Module({
  imports: [UserModule, AuthModule],
  controllers: [AdminUserController],
})
export class AdminModule {}
