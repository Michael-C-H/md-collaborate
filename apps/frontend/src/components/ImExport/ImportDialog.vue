<script setup lang="ts">
/**
 * 导入对话框
 * by AI.Coding
 *
 * 提供两种入口：单 .md 文件 / .zip 批量。导入完成后展示成功/失败列表。
 */
import { computed, ref } from 'vue'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons-vue'
import type { UploadProps } from 'ant-design-vue'
import type { ImportResult } from '@app/shared'
import { imexportApi } from '@/api/imexport.api'
import { notify } from '@/utils/notify'

const props = defineProps<{
  /** 导入到的目标父节点；null = 根 */
  parentId: number | null
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'imported'): void
}>()

const fileMd = ref<File | null>(null)
const fileZip = ref<File | null>(null)
const uploading = ref(false)
const result = ref<ImportResult | null>(null)
const visible = ref(true)

const okCount = computed(() => result.value?.items.filter((i) => i.success).length ?? 0)
const failCount = computed(() => result.value?.items.filter((i) => !i.success).length ?? 0)

// 自定义上传：拿到文件就保存到 ref，真正上传发生在"开始导入"按钮
const beforeUploadMd: UploadProps['beforeUpload'] = (file) => {
  fileMd.value = file as File
  fileZip.value = null
  return false
}
const beforeUploadZip: UploadProps['beforeUpload'] = (file) => {
  fileZip.value = file as File
  fileMd.value = null
  return false
}

async function doImport(): Promise<void> {
  if (!fileMd.value && !fileZip.value) {
    notify.warn('请先选择 .md 或 .zip 文件')
    return
  }
  uploading.value = true
  result.value = null
  try {
    const res = fileMd.value
      ? await imexportApi.importMd(fileMd.value, props.parentId)
      : await imexportApi.importZip(fileZip.value!, props.parentId)
    if (res.code === 0 && res.data) {
      result.value = res.data
      emit('imported')
      notify.success(`导入完成（${okCount.value} 成功 / ${failCount.value} 失败）`)
    } else {
      notify.error(res.message)
    }
  } catch (err) {
    notify.error((err as Error).message)
  } finally {
    uploading.value = false
  }
}

function onClose(): void {
  visible.value = false
  emit('close')
}
</script>

<template>
  <a-modal
    v-model:open="visible"
    :title="`导入到 ${parentId ? `文件夹 #${parentId}` : '根目录'}`"
    :destroy-on-close="true"
    :width="600"
    centered
    @cancel="onClose"
  >
    <a-space direction="vertical" :size="16" style="width: 100%">
      <div>
        <div class="label">单个 .md / .markdown 文件（≤ 5 MB）</div>
        <a-upload
          :before-upload="beforeUploadMd"
          :max-count="1"
          accept=".md,.markdown"
          :disabled="uploading"
          :show-upload-list="false"
        >
          <a-button>选择 .md 文件</a-button>
        </a-upload>
        <div v-if="fileMd" class="hint">
          已选：{{ fileMd.name }}（{{ Math.round(fileMd.size / 1024) }} KB）
        </div>
      </div>
      <div>
        <div class="label">批量 .zip（按目录还原；≤ 50 MB）</div>
        <a-upload
          :before-upload="beforeUploadZip"
          :max-count="1"
          accept=".zip"
          :disabled="uploading"
          :show-upload-list="false"
        >
          <a-button>选择 .zip 文件</a-button>
        </a-upload>
        <div v-if="fileZip" class="hint">
          已选：{{ fileZip.name }}（{{ Math.round(fileZip.size / 1024) }} KB）
        </div>
      </div>

      <a-list
        v-if="result"
        :data-source="result.items"
        :pagination="result.items.length > 8 ? { pageSize: 8, size: 'small' } : false"
        size="small"
        bordered
      >
        <template #header>
          <a-space>
            <a-tag color="success">{{ okCount }} 成功</a-tag>
            <a-tag v-if="failCount > 0" color="error">{{ failCount }} 失败</a-tag>
          </a-space>
        </template>
        <template #renderItem="{ item }">
          <a-list-item>
            <a-space>
              <CheckCircleOutlined v-if="item.success" style="color: #52c41a" />
              <CloseCircleOutlined v-else style="color: #f5222d" />
              <span>{{ item.name }}</span>
              <span v-if="item.error" class="err">{{ item.error }}</span>
            </a-space>
          </a-list-item>
        </template>
      </a-list>
    </a-space>

    <template #footer>
      <a-button :disabled="uploading" @click="onClose">关闭</a-button>
      <a-button type="primary" :loading="uploading" @click="doImport">
        {{ uploading ? '导入中' : '开始导入' }}
      </a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.label {
  font-size: 0.85rem;
  color: #444;
  margin-bottom: 0.4rem;
}
.hint {
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: #666;
}
.err {
  color: #f5222d;
  font-size: 0.8rem;
}
</style>
