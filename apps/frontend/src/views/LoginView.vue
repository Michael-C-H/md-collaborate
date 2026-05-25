<script setup lang="ts">
/**
 * 登录页
 * by AI.Coding
 *
 * 本地用户名密码登录 + SSO 登录入口
 */
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { CurrentUser } from '@app/shared'
import { authApi } from '@/api/auth.api'
import { useCurrentUserStore } from '@/stores/currentUser'

const router = useRouter()
const store = useCurrentUserStore()

const form = reactive({
  username: '',
  password: '',
})
const loading = ref(false)

async function onLogin(): Promise<void> {
  if (!form.username || !form.password) {
    message.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    const res = await authApi.login(form.username, form.password)
    if (res.code === 0 && res.data) {
      store.user = res.data as CurrentUser
      store.loaded = true
      message.success('登录成功')
      await router.push('/')
    } else {
      message.error(res.message || '登录失败')
    }
  } catch {
    message.error('登录失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="title">md-collab</h1>
      <p class="subtitle">在线协作 Markdown 编辑器</p>

      <a-form layout="vertical" @finish="onLogin">
        <a-form-item label="用户名">
          <a-input
            v-model:value="form.username"
            size="large"
            placeholder="请输入用户名"
            @press-enter="onLogin"
          >
            <template #prefix><UserOutlined /></template>
          </a-input>
        </a-form-item>

        <a-form-item label="密码">
          <a-input-password
            v-model:value="form.password"
            size="large"
            placeholder="请输入密码"
            @press-enter="onLogin"
          >
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            size="large"
            block
            :loading="loading"
            @click="onLogin"
          >
            登录
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}
.login-card {
  width: 380px;
  padding: 2.5rem;
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.title {
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--text-primary);
}
.subtitle {
  text-align: center;
  color: var(--text-tertiary);
  margin-bottom: 2rem;
  font-size: 0.85rem;
}
</style>
