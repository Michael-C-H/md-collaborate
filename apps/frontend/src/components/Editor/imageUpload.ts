/**
 * CodeMirror 图片上传扩展
 * by AI.Coding
 *
 * 接管 paste / drop 事件：检测到 image 文件 → 上传到后端 → 替换为 markdown 图片语法。
 * 上传过程显示占位文本，失败时插入 HTML 注释保留原意图。
 */
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { imageApi } from '@/api/image.api'

export function imageUploadExtension(docId: number): Extension {
  return EditorView.domEventHandlers({
    paste: (event, view) => {
      const items = event.clipboardData?.items
      if (!items) return false
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            event.preventDefault()
            void uploadAndInsert(view, file, docId)
            return true
          }
        }
      }
      return false
    },
    drop: (event, view) => {
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return false
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length === 0) return false
      event.preventDefault()
      // 串行上传，避免 docId 同时多张并发对服务端造成压力
      ;(async () => {
        for (const file of imageFiles) {
          await uploadAndInsert(view, file, docId)
        }
      })().catch(() => {
        // 错误已经在 uploadAndInsert 内部处理
      })
      return true
    },
  })
}

async function uploadAndInsert(view: EditorView, file: File, docId: number): Promise<void> {
  // 1. 在当前光标位置插入占位
  const placeholder = `![上传中…](uploading)`
  const sel = view.state.selection.main
  const insertFrom = sel.from
  view.dispatch({
    changes: { from: insertFrom, to: sel.to, insert: placeholder },
    selection: { anchor: insertFrom + placeholder.length },
  })
  const insertTo = insertFrom + placeholder.length

  try {
    const res = await imageApi.upload(file, docId)
    if (res.code === 0 && res.data) {
      const altRaw = file.name.replace(/\.[^.]+$/, '')
      const alt = altRaw || 'image'
      // 注意 res.data 可能是 ImageUploadResult；用类型断言取 url
      const url = (res.data as { url: string }).url
      const replacement = `![${alt}](${url})`
      view.dispatch({
        changes: { from: insertFrom, to: insertTo, insert: replacement },
      })
    } else {
      throw new Error(res.message)
    }
  } catch (err) {
    const errorText = `<!-- 图片上传失败：${(err as Error).message} -->`
    view.dispatch({
      changes: { from: insertFrom, to: insertTo, insert: errorText },
    })
  }
}
