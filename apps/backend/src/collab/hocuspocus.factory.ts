/**
 * Hocuspocus 服务工厂
 * by AI.Coding
 *
 * 在 NestJS 进程内创建并配置 Hocuspocus Server，负责：
 *   - onConnect：从 cookie 解 iron-session 拿用户 + 校验权限 + 计算 readOnly + 写入 context
 *     （我们不依赖 token，所以不用 onAuthenticate；Hocuspocus 2.x 仅在 client 传 token 时才调它）
 *   - onLoadDocument：从 nodes.yjs_state 恢复 Y.Doc
 *   - onStoreDocument：把 Y.Doc 二进制 + markdown 镜像写回 nodes 表（debounce 2s）
 *   - onDisconnect：从 presence 集合移除编辑者
 *
 * 文档名约定：客户端 HocuspocusProvider 的 name 是节点 id 的字符串形式。
 */
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Server, type Hocuspocus } from '@hocuspocus/server'
import { eq } from 'drizzle-orm'
import { unsealData } from 'iron-session'
import { Logger } from 'nestjs-pino'
import * as Y from 'yjs'
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator'
import type { DrizzleClient } from '../database/drizzle.client'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import { nodes } from '../database/schema'
import { PermissionService } from '../permission/permission.service'
import type { AppConfig } from '../config/app-config.schema'
import type { SessionData } from '../auth/session.config'
import { PresenceService } from './presence.service'

/** Hocuspocus 钩子通过 context 在阶段之间传递数据 */
interface CollabContext {
  user: CurrentUserPayload
  docId: number
}

@Injectable()
export class HocuspocusFactory implements OnApplicationShutdown {
  private server: Hocuspocus | null = null

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly permissionService: PermissionService,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient,
    private readonly presence: PresenceService,
    private readonly logger: Logger,
  ) {}

  /** 创建并配置 Hocuspocus Server（幂等） */
  build(): Hocuspocus {
    if (this.server) return this.server

    const maxEditors = this.config.get('MAX_EDITORS_PER_DOC', { infer: true })

    this.server = Server.configure({
      // debounce：内容变更后多久才触发 onStoreDocument（避免 IO 风暴）
      debounce: 2000,
      maxDebounce: 10000,

      onConnect: async (data) => {
        // 鉴权：从 cookie 解 iron-session
        const cookieHeader =
          (data.requestHeaders['cookie'] as string | undefined) ?? ''
        const user = await this.parseUserFromCookie(cookieHeader)
        if (!user) {
          this.logger.warn(
            { documentName: data.documentName },
            'collab onConnect: 未登录，拒绝连接',
          )
          throw new Error('未登录')
        }

        const docId = this.parseDocId(data.documentName)
        if (!docId) {
          this.logger.warn(
            { documentName: data.documentName },
            'collab onConnect: 文档标识非法',
          )
          throw new Error('文档标识非法')
        }

        // 至少要有 READ 才允许连接
        const isAdmin = user.role === 'ADMIN'
        const canRead = await this.permissionService.hasMinRole(
          user.userId,
          isAdmin,
          docId,
          'READ',
        )
        if (!canRead) {
          this.logger.warn(
            { docId, userId: user.userId },
            'collab onConnect: 无读权限',
          )
          throw new Error('没有访问该文档的权限')
        }

        // 写权限决定是否 readOnly
        const canWrite = await this.permissionService.hasMinRole(
          user.userId,
          isAdmin,
          docId,
          'WRITE',
        )

        let readOnly = !canWrite
        if (!readOnly) {
          const isAlreadyEditor = await this.presence.isEditor(docId, user.userId)
          if (!isAlreadyEditor) {
            const count = await this.presence.countUniqueEditors(docId)
            if (count >= maxEditors) {
              // 第 11 人 → 强制只读
              readOnly = true
            } else {
              await this.presence.addEditor(docId, user.userId)
            }
          }
        }

        data.connection.readOnly = readOnly

        // 把 user / docId 写入 context，供 onLoadDocument / onStoreDocument / onDisconnect 使用
        // Hocuspocus 各 hook 共享同一个 connection.context 引用，Object.assign 即可
        Object.assign(data.context as Record<string, unknown>, { user, docId })

        this.logger.log(
          { docId, userId: user.userId, readOnly },
          'collab onConnect: ok',
        )
      },

      onLoadDocument: async (data) => {
        const ctx = data.context as Partial<CollabContext>
        if (!ctx.docId) {
          // 鉴权失败的连接不应走到这里，但加防御
          return data.document
        }
        const rows = await this.db
          .select({ yjsState: nodes.yjsState })
          .from(nodes)
          .where(eq(nodes.id, ctx.docId))
          .limit(1)
        const buffer = rows[0]?.yjsState
        if (buffer) {
          Y.applyUpdate(data.document, new Uint8Array(buffer))
        }
        return data.document
      },

      onStoreDocument: async (data) => {
        const ctx = data.context as Partial<CollabContext>
        if (!ctx.docId) return
        // 二进制 doc state
        const update = Y.encodeStateAsUpdate(data.document)
        // markdown 镜像（前端 onUpdate 时把 markdown 写入了 Y.Text('markdown')）
        const markdown = data.document.getText('markdown').toString()
        const now = new Date()
        await this.db
          .update(nodes)
          .set({
            yjsState: Buffer.from(update),
            currentContent: markdown,
            contentUpdatedAt: now,
            updatedAt: now,
          })
          .where(eq(nodes.id, ctx.docId))
      },

      onDisconnect: async (data) => {
        const ctx = data.context as Partial<CollabContext>
        if (ctx.user && ctx.docId) {
          await this.presence.removeEditor(ctx.docId, ctx.user.userId)
        }
      },
    })

    return this.server
  }

  /** 应用关闭时停掉 Hocuspocus，确保资源释放 */
  async onApplicationShutdown(): Promise<void> {
    if (this.server) {
      await this.server.destroy()
      this.server = null
    }
  }

  /** 从客户端 documentName（约定为节点 id 字符串）解析出数字 docId */
  private parseDocId(documentName: string): number | null {
    const n = Number(documentName)
    if (!Number.isFinite(n) || n <= 0) return null
    return n
  }

  /** 从 HTTP Cookie 中解出 iron-session 加密的会话；解析失败返回 null */
  private async parseUserFromCookie(
    cookieHeader: string,
  ): Promise<CurrentUserPayload | null> {
    const password = this.config.get('SESSION_PASSWORD', { infer: true })
    const cookieName = this.config.get('SESSION_COOKIE_NAME', { infer: true })
    const cookies = parseCookieHeader(cookieHeader)
    const sealed = cookies[cookieName]
    if (!sealed) return null
    try {
      const session = await unsealData<SessionData>(sealed, { password })
      return session.user ?? null
    } catch (err) {
      this.logger.warn({ err }, '解析 iron-session 失败')
      return null
    }
  }
}

/** 简易 cookie 解析；不引入第三方库，够用即可 */
function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key) {
      try {
        result[key] = decodeURIComponent(value)
      } catch {
        result[key] = value
      }
    }
  }
  return result
}
