/**
 * 自动快照定时任务
 * by AI.Coding
 *
 * 每分钟扫描最近 5 分钟有 content_updated_at 变化的 doc，
 * 调 SnapshotService.createAutoIfChanged（hash 比对去重）。
 */
import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { Logger } from 'nestjs-pino'
import { SnapshotService } from '../snapshot.service'

@Injectable()
export class AutoSnapshotJob {
  constructor(
    private readonly service: SnapshotService,
    private readonly logger: Logger,
  ) {}

  /** 每分钟第 30 秒触发（避开整分钟峰值） */
  @Cron('30 */1 * * * *')
  async tick(): Promise<void> {
    try {
      const docs = await this.service.listDocsWithRecentChanges(5 * 60 * 1000)
      for (const docId of docs) {
        const created = await this.service.createAutoIfChanged(docId)
        if (created) {
          this.logger.log({ docId }, 'AutoSnapshotJob: 已生成快照')
        }
      }
    } catch (err) {
      this.logger.error({ err }, 'AutoSnapshotJob 失败')
    }
  }
}
