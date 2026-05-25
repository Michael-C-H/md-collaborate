/**
 * 健康检查接口
 * by AI.Coding
 *
 * 路径：/api/health（统一 /api 前缀，方便前端、Nginx、监控用同一条 URL）。
 * 标 @SkipAuth() —— 监控探活不需要登录。
 * 仅返回基础应用状态，不查 DB / Redis（保持轻量、不被下游故障拖累）。
 */
import { Controller, Get } from '@nestjs/common'
import { ok } from '../api-result'
import { SkipAuth } from '../../auth/session.guard'

@Controller('health')
@SkipAuth()
export class HealthController {
  /** 健康检查；返回应用启动状态 */
  @Get()
  check() {
    return ok({
      status: 'up',
      timestamp: new Date().toISOString(),
    })
  }
}
