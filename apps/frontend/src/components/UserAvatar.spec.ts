/**
 * UserAvatar 工具函数单测
 * by AI.Coding
 */
import { describe, expect, it } from 'vitest'
import { PALETTE_SIZE, pickColor, pickInitials } from '@/utils/avatar'

describe('pickInitials', () => {
  it('单字中文返回该字', () => {
    expect(pickInitials('王')).toBe('王')
  })

  it('2 字中文返回全名', () => {
    expect(pickInitials('张三')).toBe('张三')
  })

  it('3 字中文返回后 2 字', () => {
    expect(pickInitials('诸葛亮')).toBe('葛亮')
    expect(pickInitials('司马懿')).toBe('马懿')
  })

  it('4 字以上中文返回后 2 字', () => {
    expect(pickInitials('欧阳挪威')).toBe('挪威')
    expect(pickInitials('上官婉儿大人')).toBe('大人')
  })

  it('英文姓名取首尾单词首字母', () => {
    expect(pickInitials('John Smith')).toBe('JS')
    expect(pickInitials('alice bob carol')).toBe('AC')
    expect(pickInitials('John')).toBe('J')
  })

  it('空 / null / undefined / 全空白返回 ?', () => {
    expect(pickInitials('')).toBe('?')
    expect(pickInitials(null)).toBe('?')
    expect(pickInitials(undefined)).toBe('?')
    expect(pickInitials('   ')).toBe('?')
  })
})

describe('pickColor', () => {
  it('同一 userId 颜色稳定', () => {
    expect(pickColor(1)).toBe(pickColor(1))
    expect(pickColor('admin')).toBe(pickColor('admin'))
    expect(pickColor(987654321)).toBe(pickColor(987654321))
  })

  it('返回合法十六进制色值', () => {
    expect(pickColor(123)).toMatch(/^#[0-9A-F]{6}$/i)
  })

  it('颜色落在 16 色调色板内', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i += 1) {
      seen.add(pickColor(i))
    }
    // 200 个样本基本能覆盖到全部 16 色（djb2 在小范围 id 上分布良好）
    expect(seen.size).toBeLessThanOrEqual(PALETTE_SIZE)
    expect(seen.size).toBeGreaterThan(1)
  })
})
