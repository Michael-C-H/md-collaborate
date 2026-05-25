/**
 * 全局轻量通知封装
 * by AI.Coding
 *
 * 统一从右上角浮出的 message 提示，避免业务里到处直接 import 'ant-design-vue'。
 *
 * 用法：
 *   notify.success('已保存')
 *   notify.error(res.message)
 */
import { message } from 'ant-design-vue'

message.config({
  top: '64px', // 让 message 出现在顶栏下方
  duration: 2.5,
  maxCount: 5,
})

export const notify = {
  success(content: string): void {
    message.success(content)
  },
  error(content: string): void {
    message.error(content)
  },
  warn(content: string): void {
    message.warning(content)
  },
  info(content: string): void {
    message.info(content)
  },
}
