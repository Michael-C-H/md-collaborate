<script setup lang="ts">
/**
 * 登录失败页
 * by AI.Coding
 *
 * 通过 URL query `?code=<error_code>` 显示对应文案。
 * 后端 SsoTokenMiddleware 验证失败时跳转过来；前端守卫未检测到会话也会跳过来。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const code = computed(() => (route.query.code as string | undefined) ?? 'UNKNOWN')

/** 错误码 → 中文文案映射 */
const MESSAGE_MAP: Record<string, string> = {
  NO_SESSION: '未检测到登录会话，请回到三方系统重新进入。',
  TOKEN_CONSUMED: '登录凭证已被使用，请回到三方系统重新进入。',
  TOKEN_EXPIRED: '登录凭证已过期，请回到三方系统重新进入。',
  INVALID_TOKEN: '登录凭证无效，请回到三方系统重新进入。',
  SSO_UNAVAILABLE: '身份服务暂时不可用，请稍后再试。',
  INVALID_RESPONSE: '身份服务返回异常，请联系管理员。',
  UNKNOWN: '登录失败，请回到三方系统重新进入。',
}

const reason = computed(() => MESSAGE_MAP[code.value] ?? MESSAGE_MAP['UNKNOWN'])
</script>

<template>
  <div class="login-error">
    <a-result status="error" title="登录失败" :sub-title="reason">
      <template #extra>
        <div class="code">错误码：{{ code }}</div>
      </template>
    </a-result>
  </div>
</template>

<style scoped>
.login-error {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}
.code {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}
</style>
