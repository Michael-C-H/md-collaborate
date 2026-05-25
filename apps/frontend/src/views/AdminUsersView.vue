<script setup lang="ts">
/**
 * 管理员 — 用户管理页面
 * by AI.Coding
 *
 * 用户列表 + 创建 / 编辑 / 删除
 */
import { computed, h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()
import type { AdminUserList, CreateUserRequest, KnownUserVO, UpdateUserRequest } from '@app/shared'
import { adminApi } from '@/api/admin.api'
import { useCurrentUserStore } from '@/stores/currentUser'

const store = useCurrentUserStore()

// ── 列表状态 ──
const loading = ref(false)
const users = ref<KnownUserVO[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')

// ── 创建/编辑弹窗 ──
const showDrawer = ref(false)
const editingUser = ref<KnownUserVO | null>(null)
const form = reactive({
  username: '',
  password: '',
  displayName: '',
  role: 'USER' as 'ADMIN' | 'USER',
})
const formLoading = ref(false)

const isEdit = computed(() => !!editingUser.value)
const drawerTitle = computed(() => (isEdit.value ? '编辑用户' : '创建用户'))

async function fetchUsers(): Promise<void> {
  loading.value = true
  try {
    const res = await adminApi.listUsers(page.value, pageSize.value, keyword.value || undefined)
    if (res.code === 0 && res.data) {
      const data = res.data as AdminUserList
      users.value = data.list
      total.value = data.total
    }
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number, ps: number): void {
  page.value = p
  pageSize.value = ps
  void fetchUsers()
}

function onSearch(): void {
  page.value = 1
  void fetchUsers()
}

function openCreate(): void {
  editingUser.value = null
  form.username = ''
  form.password = ''
  form.displayName = ''
  form.role = 'USER'
  showDrawer.value = true
}

function openEdit(user: KnownUserVO): void {
  editingUser.value = user
  form.username = user.username
  form.password = ''
  form.displayName = user.displayName
  form.role = user.role
  showDrawer.value = true
}

async function onSubmit(): Promise<void> {
  if (isEdit.value) {
    await doUpdate()
  } else {
    await doCreate()
  }
}

async function doCreate(): Promise<void> {
  if (!form.username || !form.password) {
    message.warning('用户名和密码不能为空')
    return
  }
  formLoading.value = true
  try {
    const data: CreateUserRequest = {
      username: form.username,
      password: form.password,
      displayName: form.displayName || undefined,
      role: form.role,
    }
    const res = await adminApi.createUser(data)
    if (res.code === 0) {
      message.success('用户创建成功')
      showDrawer.value = false
      void fetchUsers()
    } else {
      message.error(res.message || '创建失败')
    }
  } catch {
    message.error('创建失败')
  } finally {
    formLoading.value = false
  }
}

async function doUpdate(): Promise<void> {
  if (!editingUser.value) return
  formLoading.value = true
  try {
    const data: UpdateUserRequest = {}
    if (form.displayName !== editingUser.value.displayName) data.displayName = form.displayName
    if (form.role !== editingUser.value.role) data.role = form.role
    if (form.password) data.password = form.password
    const res = await adminApi.updateUser(editingUser.value.userId, data)
    if (res.code === 0) {
      message.success('用户更新成功')
      showDrawer.value = false
      void fetchUsers()
    } else {
      message.error(res.message || '更新失败')
    }
  } catch {
    message.error('更新失败')
  } finally {
    formLoading.value = false
  }
}

function confirmDelete(user: KnownUserVO): void {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除用户「${user.displayName}」（${user.username}）吗？此操作不可撤销。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const res = await adminApi.deleteUser(user.userId)
      if (res.code === 0) {
        message.success('用户已删除')
        void fetchUsers()
      } else {
        message.error(res.message || '删除失败')
      }
    },
  })
}

const columns = [
  { title: 'ID', dataIndex: 'userId', width: 80 },
  { title: '用户名', dataIndex: 'username', width: 160 },
  { title: '显示名', dataIndex: 'displayName', width: 160 },
  {
    title: '角色',
    dataIndex: 'role',
    width: 100,
    customRender: ({ text }: { text: string }) => (text === 'ADMIN' ? '管理员' : '普通用户'),
  },
  {
    title: '登录方式',
    dataIndex: 'loginType',
    width: 100,
    customRender: ({ text }: { text: string }) => (text === 'SSO' ? 'SSO' : '本地'),
  },
  {
    title: '操作',
    key: 'action',
    width: 150,
  },
]

onMounted(() => {
  void fetchUsers()
})
</script>

<template>
  <div class="admin-users">
    <div class="header">
      <a-space align="center">
        <a-button type="text" @click="router.push('/')">
          <template #icon><ArrowLeftOutlined /></template>
        </a-button>
        <h2>用户管理</h2>
      </a-space>
      <a-space>
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索用户名或显示名"
          style="width: 240px"
          @search="onSearch"
        >
          <template #prefix><SearchOutlined /></template>
        </a-input-search>
        <a-button type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          创建用户
        </a-button>
      </a-space>
    </div>

    <a-table
      :columns="columns"
      :data-source="users"
      :loading="loading"
      row-key="userId"
      :pagination="{
        current: page,
        pageSize,
        total,
        showTotal: (t: number) => `共 ${t} 个用户`,
        onChange: onPageChange,
      }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button
              type="link"
              size="small"
              :disabled="(record as KnownUserVO).userId === store.user?.userId"
              @click="openEdit(record as KnownUserVO)"
            >
              <template #icon><EditOutlined /></template>
              编辑
            </a-button>
            <a-button
              type="link"
              size="small"
              danger
              :disabled="(record as KnownUserVO).userId === store.user?.userId"
              @click="confirmDelete(record as KnownUserVO)"
            >
              <template #icon><DeleteOutlined /></template>
              删除
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 创建/编辑抽屉 -->
    <a-drawer
      :title="drawerTitle"
      :open="showDrawer"
      :width="400"
      @close="showDrawer = false"
    >
      <a-form layout="vertical">
        <a-form-item label="用户名" :required="!isEdit">
          <a-input
            v-model:value="form.username"
            :disabled="isEdit"
            placeholder="请输入用户名"
          />
        </a-form-item>

        <a-form-item
          v-if="!isEdit || editingUser?.loginType === 'LOCAL'"
          :label="isEdit ? '新密码（留空不修改）' : '密码'"
          :required="!isEdit"
        >
          <a-input-password
            v-model:value="form.password"
            :placeholder="isEdit ? '留空则不修改密码' : '请输入密码（至少 6 位）'"
          />
        </a-form-item>

        <a-form-item label="显示名">
          <a-input
            v-model:value="form.displayName"
            placeholder="留空则使用用户名"
          />
        </a-form-item>

        <a-form-item label="角色">
          <a-radio-group v-model:value="form.role">
            <a-radio value="USER">普通用户</a-radio>
            <a-radio value="ADMIN">管理员</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>

      <template #footer>
        <a-space>
          <a-button @click="showDrawer = false">取消</a-button>
          <a-button type="primary" :loading="formLoading" @click="onSubmit">
            {{ isEdit ? '保存' : '创建' }}
          </a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>

<style scoped>
.admin-users {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
.header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}
</style>
