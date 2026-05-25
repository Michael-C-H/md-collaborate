<script setup lang="ts">
/**
 * 回收站视图
 * by AI.Coding
 *
 * - a-radio-group 切换 mine / all 视角（仅 ADMIN 看到 all）
 * - a-table 展示软删项，分页内置
 * - 恢复 / 彻底删除走 confirm + notify
 */
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeftOutlined, FolderOutlined, FileTextOutlined } from '@ant-design/icons-vue'
import type { TableColumnsType } from 'ant-design-vue'
import type { TrashItemVO } from '@app/shared'
import { trashApi } from '@/api/trash.api'
import { useCurrentUserStore } from '@/stores/currentUser'
import { notify } from '@/utils/notify'
import { confirm } from '@/utils/confirm'

const router = useRouter()
const store = useCurrentUserStore()
const isAdmin = computed(() => store.user?.role === 'ADMIN')

const scope = ref<'mine' | 'all'>('mine')
const items = ref<TrashItemVO[]>([])
const loading = ref(false)

const columns: TableColumnsType<TrashItemVO> = [
  {
    title: '类型',
    dataIndex: 'type',
    width: 80,
    customRender: ({ record }) =>
      record.type === 'FOLDER' ? h(FolderOutlined) : h(FileTextOutlined),
  },
  { title: '名称', dataIndex: 'name', ellipsis: true },
  { title: '创建者', dataIndex: 'creatorName', width: 120 },
  {
    title: '删除人',
    dataIndex: 'deletedByName',
    width: 120,
    customRender: ({ text }) => text ?? '—',
  },
  {
    title: '删除时间',
    dataIndex: 'deletedAt',
    width: 200,
    customRender: ({ text }) => new Date(text as string).toLocaleString('zh-CN'),
  },
  { title: '操作', key: 'op', width: 180, align: 'right' as const },
]

onMounted(() => refresh())
watch(scope, () => refresh())

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const res = await trashApi.list(scope.value)
    if (res.code === 0 && res.data) {
      items.value = res.data.items
    } else {
      notify.error(res.message)
    }
  } finally {
    loading.value = false
  }
}

async function onRestore(item: TrashItemVO): Promise<void> {
  const res = await trashApi.restore(item.id)
  if (res.code === 0) {
    const fallback =
      res.data && res.data.parentId === null && item.parentId !== null
        ? '（原父目录已删除，已恢复到根）'
        : ''
    notify.success(`已恢复 "${item.name}"${fallback}`)
    await refresh()
  } else {
    notify.error(res.message)
  }
}

async function onPurge(item: TrashItemVO): Promise<void> {
  if (
    !(await confirm({
      title: '彻底删除',
      content: `"${item.name}"${item.type === 'FOLDER' ? '（含其下所有内容）' : ''} 将永久删除，相关无引用图片也会被清理。此操作不可撤销。`,
      okText: '彻底删除',
      danger: true,
    }))
  ) {
    return
  }
  const res = await trashApi.purge(item.id)
  if (res.code === 0) {
    notify.success(
      `已彻底删除 ${res.data?.purgedNodeCount ?? 0} 个节点 / ${res.data?.purgedImageCount ?? 0} 个图片`,
    )
    await refresh()
  } else {
    notify.error(res.message)
  }
}

function goHome(): void {
  void router.push({ name: 'home' })
}
</script>

<template>
  <div class="trash-view">
    <a-page-header title="回收站" @back="goHome">
      <template #backIcon>
        <ArrowLeftOutlined />
      </template>
      <template #extra>
        <a-radio-group v-if="isAdmin" v-model:value="scope" button-style="solid">
          <a-radio-button value="mine">我的</a-radio-button>
          <a-radio-button value="all">全部（ADMIN）</a-radio-button>
        </a-radio-group>
      </template>
    </a-page-header>

    <a-table
      :columns="columns"
      :data-source="items"
      :loading="loading"
      :pagination="{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }"
      :row-key="(r: TrashItemVO) => r.id"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'op'">
          <a-space>
            <a-button size="small" @click="onRestore(record as TrashItemVO)">恢复</a-button>
            <a-button size="small" danger @click="onPurge(record as TrashItemVO)">彻底删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<style scoped>
.trash-view {
  padding: 0 1.5rem 1.5rem;
  max-width: 1100px;
  margin: 0 auto;
}
</style>
