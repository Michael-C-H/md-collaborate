/**
 * 审计业务服务
 * by AI.Coding
 *
 * 写日志走 `log()`：业务服务在关键写操作完成后显式调用；
 * 失败时只打 warn 不向外抛错，避免审计失败影响主流程。
 *
 * 查询走 `query()`：仅 ADMIN 通过 AuditController。
 */
import { Injectable } from '@nestjs/common'
import { Logger } from 'nestjs-pino'
import type { AuditLogVO, AuditPage, AuditQuery } from '@app/shared'
import { AuditRepo } from './audit.repo'

export interface AuditLogInput {
  userId: number
  action: string
  targetType: string
  targetId?: number | null
  detail?: unknown
}

@Injectable()
export class AuditService {
  constructor(
    private readonly repo: AuditRepo,
    private readonly logger: Logger,
  ) {}

  /** 异步写一条审计；不阻塞主流程，失败不向外抛 */
  log(input: AuditLogInput): void {
    void this.repo
      .insert({
        userId: input.userId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        detail: (input.detail ?? null) as never,
        createdAt: new Date(),
      })
      .catch((err: unknown) => {
        this.logger.warn(
          {
            err,
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId,
          },
          'audit: 写日志失败',
        )
      })
  }

  async query(q: AuditQuery): Promise<AuditPage> {
    const { items, total } = await this.repo.query(q)
    const vos: AuditLogVO[] = items.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName ?? `user_${r.userId}`,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    }))
    return { items: vos, total, page: q.page, pageSize: q.pageSize }
  }
}
