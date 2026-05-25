<script setup lang="ts">
/**
 * 顶栏：左侧 Logo，右侧入口（回收站 / 日志）+ 主题切换 + 当前用户 + 登出
 * by AI.Coding
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  BulbFilled,
  BulbOutlined,
  DeleteOutlined,
  DesktopOutlined,
  FileSearchOutlined,
  KeyOutlined,
  LogoutOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useCurrentUserStore } from '@/stores/currentUser'
import { useThemeStore, type ThemeMode } from '@/stores/theme'
import { authApi } from '@/api/auth.api'

const store = useCurrentUserStore()
const themeStore = useThemeStore()
const router = useRouter()
const isAdmin = computed(() => store.user?.role === 'ADMIN')
const isLocalUser = computed(() => store.user?.loginType === 'LOCAL')

const themeIcon = computed(() => {
  if (themeStore.mode === 'dark') return BulbOutlined
  if (themeStore.mode === 'light') return BulbFilled
  return DesktopOutlined
})

function setTheme(mode: ThemeMode): void {
  themeStore.setMode(mode)
}

async function onLogout(): Promise<void> {
  const redirect = await store.logout()
  if (redirect) {
    window.location.href = redirect
  } else {
    void router.push({ name: 'login' })
  }
}

function goTrash(): void {
  void router.push({ name: 'trash' })
}
function goAudit(): void {
  void router.push({ name: 'admin-audit' })
}
function goUsers(): void {
  void router.push({ name: 'admin-users' })
}

// ── 修改密码 ──
const showPwdModal = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwdLoading = ref(false)

function openChangePassword(): void {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
  showPwdModal.value = true
}

async function onSubmitPassword(): Promise<void> {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) {
    message.warning('请填写当前密码和新密码')
    return
  }
  if (pwdForm.newPassword.length < 6) {
    message.warning('新密码至少 6 个字符')
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    message.warning('两次输入的新密码不一致')
    return
  }
  pwdLoading.value = true
  try {
    const res = await authApi.changePassword(pwdForm.oldPassword, pwdForm.newPassword)
    if (res.code === 0) {
      message.success('密码修改成功')
      showPwdModal.value = false
    } else {
      message.error(res.message || '修改失败')
    }
  } catch {
    message.error('修改失败')
  } finally {
    pwdLoading.value = false
  }
}
</script>

<template>
  <header class="topbar">
    <div class="brand">md-collab</div>
    <a-space v-if="store.user" :size="12" align="center">
      <a-button @click="goTrash">
        <template #icon><DeleteOutlined /></template>
        回收站
      </a-button>
      <a-button v-if="isAdmin" @click="goAudit">
        <template #icon><FileSearchOutlined /></template>
        操作日志
      </a-button>
      <a-button v-if="isAdmin" @click="goUsers">
        <template #icon><TeamOutlined /></template>
        用户管理
      </a-button>

      <a-dropdown :trigger="['click']">
        <a-tooltip
          :title="
            themeStore.mode === 'light'
              ? '主题：亮色'
              : themeStore.mode === 'dark'
                ? '主题：暗色'
                : '主题：跟随系统'
          "
        >
          <a-button>
            <template #icon><component :is="themeIcon" /></template>
          </a-button>
        </a-tooltip>
        <template #overlay>
          <a-menu :selected-keys="[themeStore.mode]" @click="(e) => setTheme(e.key as ThemeMode)">
            <a-menu-item key="light">
              <BulbFilled /> 亮色
            </a-menu-item>
            <a-menu-item key="dark">
              <BulbOutlined /> 暗色
            </a-menu-item>
            <a-menu-item key="auto">
              <DesktopOutlined /> 跟随系统
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>

      <a-dropdown :trigger="['click']">
        <UserAvatar :user-id="store.user.userId" :name="store.user.displayName" :size="32" class="cursor-pointer" />
        <template #overlay>
          <a-menu>
            <a-menu-item v-if="isLocalUser" @click="openChangePassword">
              <KeyOutlined /> 修改密码
            </a-menu-item>
            <a-menu-item @click="onLogout">
              <LogoutOutlined /> 登出
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </a-space>

    <!-- 修改密码弹窗 -->
    <a-modal
      v-model:open="showPwdModal"
      title="修改密码"
      :confirm-loading="pwdLoading"
      ok-text="确认修改"
      cancel-text="取消"
      @ok="onSubmitPassword"
    >
      <a-form layout="vertical">
        <a-form-item label="当前密码">
          <a-input-password v-model:value="pwdForm.oldPassword" placeholder="请输入当前密码" />
        </a-form-item>
        <a-form-item label="新密码">
          <a-input-password v-model:value="pwdForm.newPassword" placeholder="至少 6 个字符" />
        </a-form-item>
        <a-form-item label="确认新密码">
          <a-input-password v-model:value="pwdForm.confirmPassword" placeholder="再次输入新密码" />
        </a-form-item>
      </a-form>
    </a-modal>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex: 0 0 auto;
}
.brand {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-primary);
}
.cursor-pointer {
  cursor: pointer;
}
</style>
