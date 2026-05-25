<script setup lang="ts">
/**
 * 审计日志视图（仅 ADMIN）
 * by AI.Coding
 *
 * a-table 内置分页 + 筛选区 a-input
 * 详情字段 JSON 通过 a-popover 折叠展示
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeftOutlined } from '@ant-design/icons-vue'
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue'
import type { AuditLogVO } from '@app/shared'
import { auditApi } from '@/api/audit.api'
import { useCurrentUserStore } from '@/stores/currentUser'
import { notify } from '@/utils/notify'

const router = useRouter()
const store = useCurrentUserStore()
const isAdmin = computed(() => store.user?.role === 'ADMIN')

const items = ref<AuditLogVO[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const loading = ref(false)

const filterAction = ref('')
const filterTargetType = ref('')
// a-input-number 的 v-model:value 期望 number | undefined，不能用 null
const filterUserId = ref<number | undefined>(undefined)

const columns: TableColumnsType<AuditLogVO> = [
  {
    title: '时间',
    dataIndex: 'createdAt',
    width: 180,
    customRender: ({ text }) => new Date(text as string).toLocaleString('zh-CN'),
  },
  {
    title: '操作人',
    dataIndex: 'userName',
    width: 160,
    customRender: ({ record }) => `${record.userName} (${record.userId})`,
  },
  { title: '动作', dataIndex: 'action', width: 180 },
  {
    title: '目标',
    key: 'target',
    width: 160,
    customRender: ({ record }) =>
      record.targetId !== null ? `${record.targetType} #${record.targetId}` : record.targetType,
  },
  { title: '详情', key: 'detail' },
]

onMounted(() => {
  if (!isAdmin.value) {
    void router.replace({ name: 'home' })
    return
  }
  void refresh()
})

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const res = await auditApi.list({
      page: page.value,
      pageSize: pageSize.value,
      action: filterAction.value || undefined,
      targetType: filterTargetType.value || undefined,
      userId: filterUserId.value,
    })
    if (res.code === 0 && res.data) {
      items.value = res.data.items
      total.value = res.data.total
    } else {
      notify.error(res.message)
    }
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  page.value = 1
  void refresh()
}

function onTableChange(p: TablePaginationConfig): void {
  page.value = p.current ?? 1
  pageSize.value = p.pageSize ?? 50
  void refresh()
}

function formatDetail(d: unknown): string {
  if (d === null || d === undefined) return ''
  try {
    return JSON.stringify(d, null, 2)
  } catch {
    return String(d)
  }
}

function goHome(): void {
  void router.push({ name: 'home' })
}
</script>

<template>
  <div class="audit-view">
    <a-page-header title="操作日志" @back="goHome">
      <template #backIcon>
        <ArrowLeftOutlined />
      </template>
    </a-page-header>

    <a-space class="filters" :size="8">
      <a-input
        v-model:value="filterAction"
        placeholder="动作（如 NODE_CREATE）"
        allow-clear
        style="width: 220px"
        @press-enter="onSearch"
      />
      <a-input
        v-model:value="filterTargetType"
        placeholder="目标类型（如 NODE）"
        allow-clear
        style="width: 180px"
        @press-enter="onSearch"
      />
      <a-input-number
        v-model:value="filterUserId"
        placeholder="操作人 userId"
        :controls="false"
        style="width: 160px"
        @press-enter="onSearch"
      />
      <a-button type="primary" @click="onSearch">查询</a-button>
    </a-space>

    <a-table
      :columns="columns"
      :data-source="items"
      :loading="loading"
      :row-key="(r: AuditLogVO) => r.id"
      :pagination="{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: ['20', '50', '100'],
        showTotal: (t) => `共 ${t} 条`,
      }"
      size="middle"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'detail'">
          <a-popover
            v-if="record.detail"
            placement="left"
            trigger="click"
            :overlay-style="{ maxWidth: '480px' }"
          >
            <template #content>
              <pre style="margin: 0; max-height: 360px; overflow: auto">{{ formatDetail(record.detail) }}</pre>
            </template>
            <a-button type="link" size="small">查看</a-button>
          </a-popover>
          <span v-else style="color: #ccc">—</span>
        </template>
      </template>
    </a-table>
  </div>
</template>

<style scoped>
.audit-view {
  padding: 0 1.5rem 1.5rem;
  max-width: 1280px;
  margin: 0 auto;
}
.filters {
  margin-bottom: 1rem;
}
</style>
