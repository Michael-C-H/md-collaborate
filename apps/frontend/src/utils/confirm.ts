/**
 * 异步二次确认对话框
 * by AI.Coding
 *
 * 替代散落在各处的 window.confirm。返回 Promise<boolean>，
 * true 表示用户点了"确定"，false 表示取消 / 关闭。
 *
 * 用法：
 *   if (!(await confirm({ title: '删除？', content: name, danger: true }))) return
 */
import { Modal } from 'ant-design-vue'

export interface ConfirmOptions {
  title: string
  content?: string
  okText?: string
  cancelText?: string
  /** danger=true 时确定按钮为红色，content 旁边显示警告图标 */
  danger?: boolean
}

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: opts.title,
      content: opts.content,
      okText: opts.okText ?? '确定',
      cancelText: opts.cancelText ?? '取消',
      okType: opts.danger ? 'danger' : 'primary',
      centered: true,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}
