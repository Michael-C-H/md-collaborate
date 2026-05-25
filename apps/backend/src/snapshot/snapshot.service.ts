/**
 * 版本快照业务服务
 * by AI.Coding
 *
 * 职责：
 *   - 创建：手动 / 自动 / 恢复 三种类型；自动快照仅在内容变化时建（contentHash 比对）
 *   - 列表 / 详情：附带创建者 displayName，便于前端展示
 *   - 恢复：校验在线编辑者；通过 Hocuspocus openDirectConnection 替换 ytext 内容，
 *           Hocuspocus 自动广播给所有在线连接 → 各客户端编辑器立即刷新
 *   - 清理：定时任务删除过期 AUTO 快照
 */
import { Inject, Injectable } from '@nestjs/common'
import { Logger } from 'nestjs-pino'
import { createHash } from 'node:crypto'
import { and, eq, gte, inArray, isNull } from 'drizzle-orm'
import * as Y from 'yjs'
import type {
  CreateSnapshotDto,
  SnapshotContentVO,
  SnapshotVO,
} from '@app/shared'
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../common/exceptions/app.exception'
import { AuditService } from '../audit/audit.service'
import { HocuspocusFactory } from '../collab/hocuspocus.factory'
import { PresenceService } from '../collab/presence.service'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import type { DrizzleClient } from '../database/drizzle.client'
import { knownUsers, nodes, type SnapshotRow } from '../database/schema'
import { PermissionService } from '../permission/permission.service'
import { SnapshotRepo } from './snapshot.repo'

const MAX_MANUAL_PER_DOC = 100
const AUTO_RETENTION_DAYS = 90

@Injectable()
export class SnapshotService {
  constructor(
    private readonly repo: SnapshotRepo,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient,
    private readonly permission: PermissionService,
    private readonly hocuspocus: HocuspocusFactory,
    private readonly presence: PresenceService,
    private readonly audit: AuditService,
    private readonly logger: Logger,
  ) {}

  /** 列出快照（含 createdByName） */
  async list(
    currentUserId: number,
    isAdmin: boolean,
    docId: number,
  ): Promise<SnapshotVO[]> {
    await this.ensureRead(currentUserId, isAdmin, docId)
    const rows = await this.repo.listByDoc(docId)
    if (rows.length === 0) return []
    const userIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((id) => id > 0)))
    const userMap = await this.fetchDisplayNames(userIds)
    return rows.map((r) => this.toVO(r, userMap.get(r.createdBy) ?? (r.createdBy === 0 ? '系统' : `user_${r.createdBy}`)))
  }

  /** 查询某版本完整内容 */
  async get(
    currentUserId: number,
    isAdmin: boolean,
    docId: number,
    versionNo: number,
  ): Promise<SnapshotContentVO> {
    await this.ensureRead(currentUserId, isAdmin, docId)
    const row = await this.repo.findByDocAndVersion(docId, versionNo)
    if (!row) throw new NotFoundException('快照不存在')
    const name = await this.fetchDisplayName(row.createdBy)
    return { ...this.toVO(row, name), content: row.content }
  }

  /** 创建手动快照 */
  async createManual(
    currentUserId: number,
    isAdmin: boolean,
    docId: number,
    dto: CreateSnapshotDto,
  ): Promise<SnapshotVO> {
    await this.ensureWrite(currentUserId, isAdmin, docId)
    const manualCount = await this.repo.countByType(docId, 'MANUAL')
    if (manualCount >= MAX_MANUAL_PER_DOC) {
      throw new ConflictException(`单文档手动快照不能超过 ${MAX_MANUAL_PER_DOC} 个`)
    }
    const content = await this.fetchCurrentContent(docId)
    const versionNo = (await this.repo.maxVersionNo(docId)) + 1
    const now = new Date()
    await this.repo.insertAndReturnId({
      docId,
      versionNo,
      type: 'MANUAL',
      name: dto.name,
      content,
      contentHash: sha256(content),
      createdBy: currentUserId,
      createdAt: now,
    })
    const row = (await this.repo.findByDocAndVersion(docId, versionNo)) as SnapshotRow
    const name = await this.fetchDisplayName(currentUserId)
    return this.toVO(row, name)
  }

  /** 自动快照：仅在内容变化时创建。返回是否真的新建了快照 */
  async createAutoIfChanged(docId: number): Promise<boolean> {
    const content = await this.fetchCurrentContent(docId)
    if (!content) return false
    const hash = sha256(content)
    const lastHash = await this.repo.findLatestHash(docId)
    if (lastHash === hash) return false
    const versionNo = (await this.repo.maxVersionNo(docId)) + 1
    const now = new Date()
    const expires = new Date(now.getTime() + AUTO_RETENTION_DAYS * 24 * 3600 * 1000)
    await this.repo.insertAndReturnId({
      docId,
      versionNo,
      type: 'AUTO',
      name: null,
      content,
      contentHash: hash,
      createdBy: 0, // 系统
      createdAt: now,
      expiresAt: expires,
    })
    return true
  }

  /** 恢复版本：editorCount>0 && !force → 409；恢复后通过 Hocuspocus 广播给在线客户端 */
  async restore(
    currentUserId: number,
    isAdmin: boolean,
    docId: number,
    versionNo: number,
    force: boolean,
  ): Promise<SnapshotVO> {
    await this.ensureWrite(currentUserId, isAdmin, docId)
    const snapshot = await this.repo.findByDocAndVersion(docId, versionNo)
    if (!snapshot) throw new NotFoundException('快照不存在')

    const editorCount = await this.presence.countUniqueEditors(docId)
    if (editorCount > 0 && !force) {
      throw new ConflictException(
        `当前有 ${editorCount} 位协作者在编辑，恢复将覆盖未保存的改动`,
        { editorCount },
      )
    }

    // 通过 Hocuspocus 替换 doc 内容（同时广播给所有在线连接）
    await this.applyContentToHocuspocus(docId, snapshot.content)

    // 兜底：直接更新 nodes.current_content（即使没人在线，下次打开也是这个内容）
    const now = new Date()
    await this.db
      .update(nodes)
      .set({ currentContent: snapshot.content, contentUpdatedAt: now, updatedAt: now })
      .where(eq(nodes.id, docId))

    // 生成 RESTORE_FROM 快照
    const newVer = (await this.repo.maxVersionNo(docId)) + 1
    await this.repo.insertAndReturnId({
      docId,
      versionNo: newVer,
      type: 'RESTORE_FROM',
      name: null,
      restoredFrom: versionNo,
      content: snapshot.content,
      contentHash: sha256(snapshot.content),
      createdBy: currentUserId,
      createdAt: now,
    })
    const row = (await this.repo.findByDocAndVersion(docId, newVer)) as SnapshotRow
    const name = await this.fetchDisplayName(currentUserId)
    this.audit.log({
      userId: currentUserId,
      action: 'SNAPSHOT_RESTORE',
      targetType: 'SNAPSHOT',
      targetId: row.id,
      detail: { docId, fromVersionNo: versionNo, newVersionNo: newVer, force },
    })
    return this.toVO(row, name)
  }

  /** 清理过期 AUTO 快照（CleanupJob 定时调） */
  async cleanupExpired(): Promise<number> {
    const n = await this.repo.deleteExpired(new Date())
    if (n > 0) this.logger.log({ count: n }, 'snapshot: 清理过期 AUTO 快照')
    return n
  }

  /** 查近 sinceMs 毫秒内有内容更新的 doc id 列表（AutoSnapshotJob 用） */
  async listDocsWithRecentChanges(sinceMs: number): Promise<number[]> {
    const since = new Date(Date.now() - sinceMs)
    const rows = await this.db
      .select({ id: nodes.id })
      .from(nodes)
      .where(
        and(
          eq(nodes.type, 'DOC'),
          isNull(nodes.deletedAt),
          gte(nodes.contentUpdatedAt, since),
        ),
      )
    return rows.map((r) => r.id)
  }

  // ── 内部辅助 ───────────────────────────────────────────────

  private async ensureRead(userId: number, isAdmin: boolean, docId: number): Promise<void> {
    const allowed = await this.permission.hasMinRole(userId, isAdmin, docId, 'READ')
    if (!allowed) throw new ForbiddenException('没有访问该文档的权限')
  }

  private async ensureWrite(userId: number, isAdmin: boolean, docId: number): Promise<void> {
    const allowed = await this.permission.hasMinRole(userId, isAdmin, docId, 'WRITE')
    if (!allowed) throw new ForbiddenException('没有修改该文档的权限')
  }

  private async fetchCurrentContent(docId: number): Promise<string> {
    const rows = await this.db
      .select({ c: nodes.currentContent })
      .from(nodes)
      .where(eq(nodes.id, docId))
      .limit(1)
    return rows[0]?.c ?? ''
  }

  private async fetchDisplayName(userId: number): Promise<string> {
    if (userId === 0) return '系统'
    const rows = await this.db
      .select({ n: knownUsers.displayName })
      .from(knownUsers)
      .where(eq(knownUsers.id, userId))
      .limit(1)
    return rows[0]?.n ?? `user_${userId}`
  }

  private async fetchDisplayNames(userIds: number[]): Promise<Map<number, string>> {
    if (userIds.length === 0) return new Map()
    const rows = await this.db
      .select({ userId: knownUsers.id, name: knownUsers.displayName })
      .from(knownUsers)
      .where(inArray(knownUsers.id, userIds))
    return new Map(rows.map((r) => [r.userId, r.name]))
  }

  /**
   * 通过 Hocuspocus openDirectConnection 拿到内存中的 Y.Doc，
   * 替换 markdown 内容 → Hocuspocus 自动把 update 广播给所有在线客户端。
   */
  private async applyContentToHocuspocus(docId: number, content: string): Promise<void> {
    const server = this.hocuspocus.build()
    interface DirectConn {
      document: Y.Doc
      disconnect: () => Promise<void>
    }
    const conn = await (server as unknown as {
      openDirectConnection: (name: string) => Promise<DirectConn>
    }).openDirectConnection(String(docId))
    try {
      conn.document.transact(() => {
        const ytext = conn.document.getText('markdown')
        ytext.delete(0, ytext.length)
        ytext.insert(0, content)
      })
    } finally {
      await conn.disconnect()
    }
  }

  private toVO(row: SnapshotRow, createdByName: string): SnapshotVO {
    return {
      id: row.id,
      versionNo: row.versionNo,
      type: row.type as 'AUTO' | 'MANUAL' | 'RESTORE_FROM',
      name: row.name ?? null,
      restoredFrom: row.restoredFrom ?? null,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      createdByName,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    }
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}
