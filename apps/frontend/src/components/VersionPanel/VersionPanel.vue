<script setup lang="ts">
/**
 * 版本面板（Modal）
 * by AI.Coding
 *
 * 左侧版本列表 → 右侧版本内容预览
 * 顶部"保存当前为快照"按钮
 * 恢复按钮 → 后端 editorCount>0 时返回 409，弹 confirm 询问 force
 */
import { onMounted, ref } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import type { RestoreConflictData, SnapshotContentVO, SnapshotVO } from '@app/shared'
import { snapshotApi } from '@/api/snapshot.api'
import { notify } from '@/utils/notify'
import { confirm } from '@/utils/confirm'

const props = defineProps<{
  docId: number
  docName: string
}>()

const emit = defineEmits<{
  (event: 'close'): void
}>()

const open = ref(true)
const loading = ref(false)
const list = ref<SnapshotVO[]>([])
const preview = ref<SnapshotContentVO | null>(null)

const showNameDialog = ref(false)
const newName = ref('')

onMounted(() => refresh())

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const res = await snapshotApi.list(props.docId)
    if (res.code === 0 && Array.isArray(res.data)) {
      list.value = res.data
    } else {
      notify.error(res.message)
    }
  } finally {
    loading.value = false
  }
}

async function viewVersion(s: SnapshotVO): Promise<void> {
  const res = await snapshotApi.get(props.docId, s.versionNo)
  if (res.code === 0 && res.data) {
    preview.value = res.data as SnapshotContentVO
  } else {
    notify.error(res.message)
  }
}

async function createManual(): Promise<void> {
  const name = newName.value.trim()
  if (!name) {
    notify.warn('请输入快照名称')
    return
  }
  const res = await snapshotApi.create(props.docId, { name })
  if (res.code === 0) {
    showNameDialog.value = false
    newName.value = ''
    notify.success('快照已创建')
    await refresh()
  } else {
    notify.error(res.message)
  }
}

async function restore(s: SnapshotVO, force = false): Promise<void> {
  const res = await snapshotApi.restore(props.docId, s.versionNo, { force })
  if (res.code === 0) {
    preview.value = null
    notify.success(`已恢复到 v${s.versionNo}`)
    await refresh()
    return
  }
  if (res.code === 409) {
    const editorCount = (res.data as RestoreConflictData | null)?.editorCount ?? 0
    const msg =
      editorCount > 0
        ? `当前有 ${editorCount} 位协作者在编辑。强制恢复会覆盖未保存的改动，继续？`
        : '存在冲突，是否强制恢复？'
    if (await confirm({ title: '恢复确认', content: msg, danger: true })) {
      await restore(s, true)
    }
    return
  }
  notify.error(res.message)
}

function formatType(t: SnapshotVO['type']): string {
  if (t === 'AUTO') return '自动'
  if (t === 'MANUAL') return '手动'
  return '恢复'
}

function typeTagColor(t: SnapshotVO['type']): string {
  if (t === 'AUTO') return 'default'
  if (t === 'MANUAL') return 'blue'
  return 'orange'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN')
}

function onClose(): void {
  open.value = false
  emit('close')
}
</script>

<template>
  <a-modal
    v-model:open="open"
    :title="`版本历史 — ${docName}`"
    :width="900"
    :footer="null"
    :destroy-on-close="true"
    centered
    @cancel="onClose"
  >
    <div class="actions">
      <template v-if="!showNameDialog">
        <a-button type="primary" @click="showNameDialog = true">📸 保存当前为快照</a-button>
      </template>
      <a-space v-else style="width: 100%">
        <a-input
          v-model:value="newName"
          placeholder="给这个版本起个名字（≤ 50 字）"
          :maxlength="50"
          style="width: 320px"
          @press-enter="createManual"
        />
        <a-button type="primary" @click="createManual">创建</a-button>
        <a-button @click="showNameDialog = false; newName = ''">取消</a-button>
      </a-space>
    </div>

    <div class="body">
      <a-list
        class="version-list"
        :loading="loading"
        :data-source="list"
        :locale="{ emptyText: '还没有任何版本' }"
        size="small"
      >
        <template #renderItem="{ item }">
          <a-list-item
            class="version-item"
            :class="{ active: preview?.id === item.id }"
            @click="viewVersion(item)"
          >
            <div class="vi-row">
              <a-tag :color="typeTagColor(item.type)" style="margin: 0">
                {{ formatType(item.type) }}
              </a-tag>
              <div class="vi-text">
                <div class="name">{{ item.name ?? `v${item.versionNo}` }}</div>
                <div class="meta">{{ item.createdByName }} · {{ formatDate(item.createdAt) }}</div>
              </div>
              <a-button
                size="small"
                type="link"
                @click.stop="restore(item)"
              >
                <template #icon><ReloadOutlined /></template>
                恢复
              </a-button>
            </div>
          </a-list-item>
        </template>
      </a-list>

      <div class="preview">
        <header v-if="preview" class="preview-header">
          <strong>{{ preview.name ?? `v${preview.versionNo}` }}</strong>
          <span class="meta">
            {{ preview.createdByName }} · {{ formatDate(preview.createdAt) }}
          </span>
        </header>
        <pre v-if="preview" class="content">{{ preview.content }}</pre>
        <a-empty v-else description="从左侧选择一个版本查看内容" class="empty" />
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.body {
  display: flex;
  height: 60vh;
  border-top: 1px solid var(--border-color);
}
.version-list {
  width: 340px;
  border-right: 1px solid var(--border-color);
  overflow: auto;
}
.version-item {
  cursor: pointer;
}
.version-item.active {
  background: var(--bg-active);
}
.version-item:hover {
  background: var(--bg-hover);
}
.vi-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
.vi-text {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 0.9rem;
  color: var(--text-primary);
}
.meta {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}
.preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.preview-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.content {
  flex: 1;
  margin: 0;
  padding: 1rem;
  overflow: auto;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--text-primary);
}
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
