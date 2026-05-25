/**
 * 过期快照清理定时任务
 * by AI.Coding
 *
 * 每日凌晨 3 点清理 expires_at <= now 的 AUTO 快照。
 */
import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { Logger } from 'nestjs-pino'
import { SnapshotService } from '../snapshot.service'

@Injectable()
export class CleanupJob {
  constructor(
    private readonly service: SnapshotService,
    private readonly logger: Logger,
  ) {}

  @Cron('0 0 3 * * *')
  async tick(): Promise<void> {
    try {
      await this.service.cleanupExpired()
    } catch (err) {
      this.logger.error({ err }, 'CleanupJob 失败')
    }
  }
}
