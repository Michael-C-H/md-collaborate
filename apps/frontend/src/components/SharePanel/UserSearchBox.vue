<script setup lang="ts">
/**
 * 用户检索输入框（分享面板专用）
 * by AI.Coding
 *
 * 行为：
 *   - 输入实时 debounce 300ms → /api/users/search 模糊检索 → 填 a-auto-complete options
 *   - 选项点击 → emit select
 *   - 直接 Enter（无下拉选择）→ 走 /api/users/by-username 精确匹配
 *     - 找到 → emit select
 *     - 找不到 → 通过 notify 弹"该用户尚未访问本系统"
 */
import { computed, ref, watch } from 'vue'
import type { KnownUserVO } from '@app/shared'
import { userApi } from '@/api/user.api'
import { notify } from '@/utils/notify'

const props = defineProps<{
  /** 已在协作者列表的用户 id，下拉时过滤掉 */
  excludeUserIds?: number[]
}>()

const emit = defineEmits<{
  (event: 'select', user: KnownUserVO): void
}>()

const keyword = ref('')
const list = ref<KnownUserVO[]>([])
const loading = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(keyword, (v) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!v.trim()) {
    list.value = []
    return
  }
  debounceTimer = setTimeout(async () => {
    loading.value = true
    try {
      const res = await userApi.search(v.trim())
      list.value = res.code === 0 && Array.isArray(res.data) ? res.data : []
    } finally {
      loading.value = false
    }
  }, 300)
})

const options = computed(() => {
  const excludes = new Set(props.excludeUserIds ?? [])
  return list.value
    .filter((u) => !excludes.has(u.userId))
    .map((u) => ({
      value: String(u.userId),
      label: `${u.displayName} (${u.username})`,
      user: u,
    }))
})

function onSelect(_value: unknown, option: unknown): void {
  const u = (option as { user: KnownUserVO }).user
  emit('select', u)
  keyword.value = ''
  list.value = []
}

async function tryExactAdd(): Promise<void> {
  const v = keyword.value.trim()
  if (!v) return
  try {
    const res = await userApi.byUsername(v)
    if (res.code === 0 && res.data) {
      emit('select', res.data)
      keyword.value = ''
      list.value = []
    } else {
      notify.warn('该用户尚未访问本系统，请对方先登录一次后再添加')
    }
  } catch {
    notify.warn('该用户尚未访问本系统，请对方先登录一次后再添加')
  }
}
</script>

<template>
  <a-auto-complete
    v-model:value="keyword"
    :options="options"
    placeholder="输入姓名或 username 检索；Enter 精确匹配"
    style="width: 100%"
    :filter-option="false"
    @select="onSelect"
    @press-enter="tryExactAdd"
  >
    <template #notFoundContent>
      <span style="color: #999">{{ loading ? '检索中…' : '无匹配结果' }}</span>
    </template>
  </a-auto-complete>
</template>
