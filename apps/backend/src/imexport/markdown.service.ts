/**
 * Markdown 导入 / 导出（基础）
 * by AI.Coding
 *
 * 负责：
 *   - 创建新 DOC 节点并初始化内容（含 yjs_state，确保打开协同时能加载到初始内容）
 *   - 读取当前 DOC 的 markdown（导出 / PDF 渲染都用这个）
 */
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import * as Y from 'yjs'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import type { DrizzleClient } from '../database/drizzle.client'
import { nodes } from '../database/schema'
import { NodeService } from '../node/node.service'

export interface ImportItemResult {
  name: string
  success: boolean
  nodeId: number | null
  error: string | null
}

@Injectable()
export class MarkdownImporter {
  constructor(
    private readonly nodeService: NodeService,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient,
  ) {}

  /** 把单个 markdown 文件导入为一个 DOC 节点（含初始 yjs_state） */
  async importFile(
    currentUserId: number,
    isAdmin: boolean,
    parentId: number | null,
    fileName: string,
    content: string,
  ): Promise<ImportItemResult> {
    const baseName = fileName.replace(/\.(md|markdown)$/i, '').trim()
    const name = (baseName || 'untitled').slice(0, 100)
    try {
      const node = await this.nodeService.create(currentUserId, isAdmin, {
        parentId,
        type: 'DOC',
        name,
      })
      await this.initDocContent(node.id, content)
      return { name: fileName, success: true, nodeId: node.id, error: null }
    } catch (err) {
      return { name: fileName, success: false, nodeId: null, error: (err as Error).message }
    }
  }

  /**
   * 初始化文档内容：
   *   - 在内存中构造一个 Y.Doc，把 markdown 文本插入 getText('markdown')
   *   - encodeStateAsUpdate 得到二进制 state，写入 nodes.yjs_state
   *   - 同时写入 nodes.current_content（用于导出 / 列表显示）
   * 这样首次有客户端打开时，Hocuspocus onLoadDocument 能恢复出有内容的 doc。
   */
  async initDocContent(docId: number, markdown: string): Promise<void> {
    const ydoc = new Y.Doc()
    ydoc.transact(() => {
      const ytext = ydoc.getText('markdown')
      ytext.insert(0, markdown)
    })
    const yjsState = Y.encodeStateAsUpdate(ydoc)
    const now = new Date()
    await this.db
      .update(nodes)
      .set({
        currentContent: markdown,
        yjsState: Buffer.from(yjsState),
        contentUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(nodes.id, docId))
    ydoc.destroy()
  }

  /** 取当前 DOC 的 markdown（用于导出 / PDF 渲染） */
  async getDocContent(docId: number): Promise<string> {
    const rows = await this.db
      .select({ c: nodes.currentContent })
      .from(nodes)
      .where(eq(nodes.id, docId))
      .limit(1)
    return rows[0]?.c ?? ''
  }
}
