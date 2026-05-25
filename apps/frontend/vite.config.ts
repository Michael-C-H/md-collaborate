/**
 * Vite 配置
 * by AI.Coding
 *
 * 开发期：/api、/ws 走 vite proxy 到后端 3000
 * 生产期：构建静态文件交给 Nginx，Nginx 反代 /api、/ws 到 app:3000
 *
 * Ant Design Vue 通过 unplugin-vue-components 自动按需引入，
 * 不需要在 main.ts 注册全部组件，未使用的组件不会进 bundle。
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [
        AntDesignVueResolver({
          // v4 用 CSS-in-JS（cssinjs），样式按需自动注入，不需要每组件单独 import css
          importStyle: false,
          resolveIcons: false,
        }),
      ],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 注意：WebSocket 代理时 target 仍然写 http://（让 Vite 内部去做 upgrade 切换），
      // 写成 ws:// 会导致 upgrade 握手失败。
      '/ws': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
