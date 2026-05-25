import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'

/**
 * 健康检查模块
 * by AI.Coding
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
