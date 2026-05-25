<script setup lang="ts">
/**
 * 新建 / 重命名节点对话框
 * by AI.Coding
 *
 * 通过 props 控制模式（创建 vs 重命名）和上下文（parentId / nodeId / 默认值）。
 * 通过 emit 触发提交（父组件负责调 store）。
 */
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  /** 'create-folder' | 'create-doc' | 'rename' */
  mode: 'create-folder' | 'create-doc' | 'rename'
  /** 创建模式下的父节点 id，null = 根 */
  parentId?: number | null
  /** 重命名时的初始值 */
  initialName?: string
  /** 重命名时的节点 id */
  nodeId?: number
  /** 控制对话框打开 */
  open: boolean
}>()

const emit = defineEmits<{
  (event: 'submit', payload: { name: string }): void
  (event: 'update:open', value: boolean): void
}>()

const name = ref(props.initialName ?? '')
const error = ref<string | null>(null)
// a-input 的实例没有稳定的导出类型，用 any + focus 调用足矣
const inputRef = ref<{ focus: () => void } | null>(null)

watch(
  () => props.open,
  (v) => {
    if (v) {
      name.value = props.initialName ?? ''
      error.value = null
      void nextTick(() => inputRef.value?.focus())
    }
  },
)

const title = computed(() => {
  switch (props.mode) {
    case 'create-folder':
      return '新建文件夹'
    case 'create-doc':
      return '新建文档'
    case 'rename':
      return '重命名'
  }
})

const placeholder = computed(() =>
  props.mode === 'create-folder' ? '文件夹名称' : props.mode === 'create-doc' ? '文档名称' : '新名称',
)

const FORBIDDEN_RE = /[/\\:*?"<>|]/

function onSubmit(): void {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = '名称不能为空'
    return
  }
  if (trimmed.length > 100) {
    error.value = '名称最多 100 字符'
    return
  }
  if (FORBIDDEN_RE.test(trimmed)) {
    error.value = '名称不能包含 / \\ : * ? " < > |'
    return
  }
  error.value = null
  emit('submit', { name: trimmed })
  emit('update:open', false)
}

function onCancel(): void {
  emit('update:open', false)
}
</script>

<template>
  <a-modal
    :open="open"
    :title="title"
    :ok-text="'确定'"
    :cancel-text="'取消'"
    :destroy-on-close="true"
    centered
    @ok="onSubmit"
    @cancel="onCancel"
  >
    <a-form layout="vertical" @submit.prevent="onSubmit">
      <a-form-item :validate-status="error ? 'error' : ''" :help="error ?? undefined">
        <a-input
          ref="inputRef"
          v-model:value="name"
          :placeholder="placeholder"
          :maxlength="100"
          @press-enter="onSubmit"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
