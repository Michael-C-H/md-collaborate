/**
 * 前端应用入口
 * by AI.Coding
 *
 * AD Vue 通过 unplugin-vue-components 自动按需 import，这里只需引入 reset.css
 * 防止默认 button / form 等元素样式被全局 CSS 干扰。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import { router } from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
