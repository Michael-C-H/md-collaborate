/**
 * 协同 WebSocket 工厂
 * by AI.Coding
 *
 * 用 HocuspocusProvider 连接后端 /ws，name 是节点 id 字符串。
 * 浏览器自动带 cookie；后端 onConnect 从 cookie 解 iron-session 取用户。
 */
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

export interface CollabHandles {
  ydoc: Y.Doc
  provider: HocuspocusProvider
}

export interface CollabAwareness {
  userId: number
  name: string
  color: string
}

/**
 * 把 #RRGGBB 颜色叠加 alpha 通道（'33' ≈ 20%），用于 y-codemirror.next
 * 的远程选区背景高亮（colorLight）。
 */
function withAlpha(color: string, alphaHex = '33'): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color + alphaHex
  return color
}

/**
 * 创建协同 provider。
 * @param docId 节点 id
 * @param awareness 当前用户信息（用于 awareness state 广播给协作者）
 * @param onStatus 连接状态变化回调（'connecting' | 'connected' | 'disconnected'）
 */
export function createCollabProvider(
  docId: number,
  awareness: CollabAwareness,
  onStatus?: (status: string) => void,
): CollabHandles {
  const ydoc = new Y.Doc()
  // 同源切换为 ws/wss；开发期 vite proxy `/ws/*` 自动转发，生产由 Nginx
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/ws`

  const provider = new HocuspocusProvider({
    url: wsUrl,
    name: String(docId),
    document: ydoc,
    onStatus: ({ status }) => onStatus?.(status),
    onAuthenticationFailed: ({ reason }) => {
      // eslint-disable-next-line no-console
      console.error('[collab] 鉴权失败：', reason)
    },
  })

  // 广播本地用户信息：
  //   - name / color 给 y-codemirror.next 渲染远程光标 + 名签
  //   - colorLight 给远程选区半透明高亮
  //   - userId 给 PresenceBar 做去重
  provider.awareness?.setLocalStateField('user', {
    userId: awareness.userId,
    name: awareness.name,
    color: awareness.color,
    colorLight: withAlpha(awareness.color),
  })

  return { ydoc, provider }
}
