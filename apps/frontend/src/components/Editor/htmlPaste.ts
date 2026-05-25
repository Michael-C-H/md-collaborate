/**
 * CodeMirror 富文本粘贴转 Markdown 扩展
 * by AI.Coding
 *
 * 行为：
 *   - 粘贴时若剪贴板里有 image/* → 让给 imageUploadExtension 处理（return false）
 *   - 若有 text/html → 用 turndown 转成 markdown 后插入编辑器
 *   - 只有纯文本 → 让 CodeMirror 走默认逻辑（return false）
 *
 * 涵盖：Word / 浏览器富文本 / Notion / Confluence 等带样式的内容。
 * GFM 扩展支持表格 / 删除线 / 任务列表。
 */
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import TurndownService from 'turndown'
// turndown-plugin-gfm 没有 d.ts，CJS 默认导出 .gfm
// @ts-expect-error: no types shipped
import * as turndownPluginGfm from 'turndown-plugin-gfm'

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
})
turndown.use((turndownPluginGfm as { gfm: TurndownService.Plugin }).gfm)

// Word / Office 残留 `<o:p>` 之类自闭合标签 → 直接干掉
turndown.addRule('remove-office-tags', {
  filter: (node) => /^(o:p|w:|m:)/i.test(node.nodeName ?? ''),
  replacement: () => '',
})

export function htmlPasteExtension(): Extension {
  return EditorView.domEventHandlers({
    paste: (event, view) => {
      const cd = event.clipboardData
      if (!cd) return false

      // 图片由 imageUploadExtension 接管；这里碰到图片直接放行
      const hasImage = Array.from(cd.items).some((i) => i.type.startsWith('image/'))
      if (hasImage) return false

      const html = cd.getData('text/html')
      if (!html.trim()) return false

      let markdown: string
      try {
        markdown = turndown.turndown(html).trim()
      } catch {
        return false
      }
      if (!markdown) return false

      event.preventDefault()
      const sel = view.state.selection.main
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: markdown },
        selection: { anchor: sel.from + markdown.length },
      })
      return true
    },
  })
}
