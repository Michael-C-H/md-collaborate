<script setup lang="ts">
/**
 * 分享面板
 * by AI.Coding
 *
 * a-modal 形态：
 *   - 顶部搜索（a-auto-complete）+ 待添加预览（角色 a-select + 添加按钮）
 *   - 列表 a-list：每行 头像 + 姓名 + 角色 a-select + 移除按钮
 *   - 错误通过 notify 弹出
 */
import { onMounted, ref } from 'vue'
import type { KnownUserVO, PermissionRole, PermissionVO } from '@app/shared'
import UserAvatar from '@/components/UserAvatar.vue'
import { permissionApi } from '@/api/permission.api'
import { notify } from '@/utils/notify'
import { confirm } from '@/utils/confirm'
import UserSearchBox from './UserSearchBox.vue'

const props = defineProps<{
  nodeId: number
  nodeName: string
}>()

const emit = defineEmits<{
  (event: 'close'): void
}>()

const open = ref(true)
const loading = ref(false)
const collaborators = ref<PermissionVO[]>([])
const pendingUser = ref<KnownUserVO | null>(null)
const pendingRole = ref<PermissionRole>('WRITE')

const ROLE_OPTIONS = [
  { value: 'READ', label: '只读' },
  { value: 'WRITE', label: '可写' },
  { value: 'MANAGE', label: '管理' },
]

onMounted(() => refresh())

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const res = await permissionApi.list(props.nodeId)
    if (res.code === 0 && Array.isArray(res.data)) {
      collaborators.value = res.data
    } else {
      notify.error(res.message)
    }
  } catch (err) {
    notify.error((err as Error).message)
  } finally {
    loading.value = false
  }
}

function onSelectUser(u: KnownUserVO): void {
  pendingUser.value = u
  pendingRole.value = 'WRITE'
}

async function doAdd(): Promise<void> {
  const u = pendingUser.value
  if (!u) return
  try {
    const res = await permissionApi.grant(props.nodeId, u.userId, pendingRole.value)
    if (res.code === 0) {
      pendingUser.value = null
      notify.success(`已添加 ${u.displayName}`)
      await refresh()
    } else {
      notify.error(res.message)
    }
  } catch (err) {
    notify.error((err as Error).message)
  }
}

async function doChangeRole(p: PermissionVO, role: PermissionRole): Promise<void> {
  try {
    const res = await permissionApi.grant(props.nodeId, p.userId, role)
    if (res.code === 0) {
      await refresh()
    } else {
      notify.error(res.message)
    }
  } catch (err) {
    notify.error((err as Error).message)
  }
}

async function doRevoke(p: PermissionVO): Promise<void> {
  if (!(await confirm({ title: '移除协作者', content: `确认移除 ${p.displayName} 的权限？`, danger: true }))) {
    return
  }
  try {
    const res = await permissionApi.revoke(props.nodeId, p.userId)
    if (res.code === 0) {
      notify.success('已移除')
      await refresh()
    } else {
      notify.error(res.message)
    }
  } catch (err) {
    notify.error((err as Error).message)
  }
}

function onClose(): void {
  open.value = false
  emit('close')
}
</script>

<template>
  <a-modal
    v-model:open="open"
    :title="`分享 — ${nodeName}`"
    :footer="null"
    :width="560"
    :destroy-on-close="true"
    centered
    @cancel="onClose"
  >
    <section style="margin-bottom: 1rem">
      <div class="label">添加协作者</div>
      <UserSearchBox
        :exclude-user-ids="collaborators.map((c) => c.userId)"
        @select="onSelectUser"
      />
      <div v-if="pendingUser" class="pending">
        <UserAvatar :user-id="pendingUser.userId" :name="pendingUser.displayName" :size="32" />
        <div class="pending-info">
          <div>{{ pendingUser.displayName }}</div>
          <div class="username">{{ pendingUser.username }}</div>
        </div>
        <a-select
          v-model:value="pendingRole"
          :options="ROLE_OPTIONS"
          style="width: 100px"
          size="small"
        />
        <a-button type="primary" size="small" @click="doAdd">添加</a-button>
        <a-button size="small" @click="pendingUser = null">取消</a-button>
      </div>
    </section>

    <section>
      <div class="label">当前协作者（{{ collaborators.length }}）</div>
      <a-list :loading="loading" :data-source="collaborators" :locale="{ emptyText: '暂无协作者' }">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta>
              <template #avatar>
                <UserAvatar :user-id="item.userId" :name="item.displayName" :size="32" />
              </template>
              <template #title>
                {{ item.displayName }}
                <a-tag v-if="item.ssoRole === 'ADMIN'" color="gold" style="margin-left: 0.4rem">
                  系统管理员
                </a-tag>
              </template>
              <template #description>
                <span class="username">{{ item.username }}</span>
              </template>
            </a-list-item-meta>
            <a-space>
              <a-select
                :value="item.role"
                :options="ROLE_OPTIONS"
                style="width: 100px"
                size="small"
                @change="(v: unknown) => doChangeRole(item, v as PermissionRole)"
              />
              <a-button type="text" danger size="small" @click="doRevoke(item)">移除</a-button>
            </a-space>
          </a-list-item>
        </template>
      </a-list>
    </section>
  </a-modal>
</template>

<style scoped>
.label {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  margin-bottom: 0.5rem;
}
.pending {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.6rem;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
}
.pending-info {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-primary);
}
.username {
  color: var(--text-tertiary);
  font-size: 0.75rem;
}
</style>
