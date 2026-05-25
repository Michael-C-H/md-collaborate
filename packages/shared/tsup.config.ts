import { defineConfig } from 'tsup'

// ─────────────────────────────────────────────────────────────────
// 共享包的双格式构建配置（ESM + CJS + 类型声明）
// by AI.Coding
//
// 显式指定输出文件名：esm → index.js，cjs → index.cjs
// 不依赖 package.json 的 "type" 字段做隐式推断，避免不同 type 设置下
// 输出名漂移（cjs 可能变成 index.js 或 index.cjs）导致 exports 不匹配。
// ─────────────────────────────────────────────────────────────────
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // 共享包不打包依赖（zod 由消费者自己装）
  external: ['zod'],
  // 显式锁定输出后缀
  outExtension({ format }) {
    return format === 'cjs' ? { js: '.cjs' } : { js: '.js' }
  },
})
