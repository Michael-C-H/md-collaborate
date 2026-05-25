/**
 * Vitest 配置（前端单测）
 * by AI.Coding
 *
 * 仅做纯 TS 工具函数测试（如 utils/avatar）；不渲染 Vue 组件。
 */
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.{spec,test}.ts'],
  },
})
