/**
 * 回收站定时清理任务
 * by AI.Coding
 *
 * 每天凌晨 03:17 跑一次，删除软删时间超过 TRASH_RETENTION_DAYS 的所有节点。
 * 时间错峰避开整点 / 半点拥堵。
 */
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { Logger } from 'nestjs-pino'
import type { AppConfig } from '../config/app-config.schema'
import { TrashService } from './trash.service'

@Injectable()
export class TrashPurgeJob {
  private readonly retentionDays: number

  constructor(
    private readonly service: TrashService,
    private readonly logger: Logger,
    config: ConfigService<AppConfig, true>,
  ) {
    this.retentionDays = config.get('TRASH_RETENTION_DAYS', { infer: true })
  }

  @Cron('17 3 * * *')
  async run(): Promise<void> {
    try {
      const r = await this.service.purgeExpired(this.retentionDays)
      this.logger.log(r, 'TrashPurgeJob 完成')
    } catch (err) {
      this.logger.error({ err }, 'TrashPurgeJob 异常')
    }
  }
}
