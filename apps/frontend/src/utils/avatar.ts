/**
 * 头像工具函数
 * by AI.Coding
 *
 * 两个职责：
 *   pickInitials(name) — 从姓名提取显示文字（中文后 2 字 / 英文首字母 / 空兜底）
 *   pickColor(userId) — 基于 user_id 稳定哈希出固定 16 色调色板里的某一色
 */

/** 全中文字符判断（Unicode CJK 基础块） */
const CHINESE_ONLY_RE = /^[一-龥]+$/

/** 16 色调色板（高对比度，配白字可读） */
const PALETTE: readonly string[] = [
  '#1F77B4',
  '#FF7F0E',
  '#2CA02C',
  '#D62728',
  '#9467BD',
  '#8C564B',
  '#E377C2',
  '#7F7F7F',
  '#BCBD22',
  '#17BECF',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
]

/** djb2 字符串哈希；稳定、低冲突，足够头像调色板分布 */
function hash(input: string): number {
  let h = 5381
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * 从姓名提取头像显示文字。
 * 规则：
 *   - 纯中文：1 字 → 该字；2 字 → 全名；≥3 字 → 后 2 字
 *   - 非纯中文：拆词取首尾首字母（最多 2 个）
 *   - 空 / 全空白 → '?'
 */
export function pickInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'

  if (CHINESE_ONLY_RE.test(trimmed)) {
    if (trimmed.length <= 2) return trimmed
    return trimmed.slice(-2)
  }

  // 英文 / 混合：按空白拆词
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return '?'
  const first = words[0]?.[0] ?? ''
  if (words.length === 1) return first.toUpperCase() || '?'
  const last = words[words.length - 1]?.[0] ?? ''
  return `${first}${last}`.toUpperCase() || '?'
}

/**
 * 根据 user_id（或任意稳定标识）选取调色板颜色。
 * 同一输入永远返回同一颜色。
 */
export function pickColor(userId: number | string): string {
  const idx = hash(String(userId)) % PALETTE.length
  // 此处 PALETTE 索引 0..15 必有值；用 `as string` 避免 noUncheckedIndexedAccess 误报
  return PALETTE[idx] as string
}

/** 暴露调色板长度便于测试 */
export const PALETTE_SIZE = PALETTE.length
