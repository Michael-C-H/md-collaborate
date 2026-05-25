<script setup lang="ts">
/**
 * 文档树（侧边栏）— Ant Design Vue a-tree 版本
 * by AI.Coding
 *
 * 关键能力：
 *   - 树形展开 / 折叠（受控 expandedKeys）
 *   - 拖拽移动：drop 到文件夹 → 改 parentId；drop 到文档同级 → 取同级父
 *   - 右键节点：弹 a-dropdown 菜单（新建子项 / 重命名 / 分享 / 删除 / 导入到此处）
 *   - 顶栏：根级新建文件夹 / 根级新建文档 / 导入到根
 *   - 选中：与 store.activeId 双向同步
 */
import { computed, h, ref, watch } from 'vue'
import {
  DownOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PlusOutlined,
  ImportOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import type { NodeTreeVO } from '@app/shared'
import { useDocTreeStore } from '@/stores/docTree'
import { notify } from '@/utils/notify'
import { confirm } from '@/utils/confirm'
import NewNodeDialog from './NewNodeDialog.vue'

type DialogMode = 'create-folder' | 'create-doc' | 'rename'
interface DialogContext {
  mode: DialogMode
  parentId: number | null
  nodeId?: number
  initialName?: string
}

interface DocTreeItem {
  key: number
  title: string
  type: 'FOLDER' | 'DOC'
  isLeaf: boolean
  parentId: number | null
  raw: NodeTreeVO
  children?: DocTreeItem[]
}

const props = withDefaults(
  defineProps<{
    treeData: NodeTreeVO[]
    title?: string
    readonly?: boolean
    defaultCollapsed?: boolean
  }>(),
  { title: '文档', readonly: false, defaultCollapsed: false },
)

const store = useDocTreeStore()

const collapsed = ref(props.defaultCollapsed)
const expandedKeys = ref<number[]>([])
const selectedKeys = ref<number[]>([])
const dialog = ref<DialogContext | null>(null)
const dialogOpen = ref(false)

const emit = defineEmits<{
  (event: 'open-doc', payload: { id: number; name: string }): void
  (event: 'share', node: NodeTreeVO): void
  (event: 'import-here', parentId: number | null): void
}>()

watch(
  () => store.activeId,
  (id) => {
    selectedKeys.value = id === null ? [] : [id]
  },
)

/** 把 NodeTreeVO 树平铺转换成 a-tree 的 data 结构 */
const treeItems = computed<DocTreeItem[]>(() => {
  const convert = (n: NodeTreeVO): DocTreeItem => ({
    key: n.id,
    title: n.name,
    type: n.type,
    isLeaf: n.type === 'DOC',
    parentId: n.parentId,
    raw: n,
    children: n.children?.length ? n.children.map(convert) : undefined,
  })
  return props.treeData.map(convert)
})

const hasTree = computed(() => props.treeData.length > 0)

/**
 * 节点点击：DOC → 打开；FOLDER → 切展开/收起
 *
 * 注：AD Vue 的事件签名用了泛型 DataNode，不带我们的 type/parentId/raw 字段；
 * 这里参数声明 any，函数内手动 cast 成 DocTreeItem。
 */
function onSelect(_keys: unknown, info: any): void {
  const item = info?.node?.dataRef as DocTreeItem | undefined
  if (!item) return
  store.setActive(item.key)
  if (item.type === 'DOC') {
    emit('open-doc', { id: item.key, name: item.title })
  } else {
    toggleExpand(item.key)
  }
}

function toggleExpand(key: number): void {
  const i = expandedKeys.value.indexOf(key)
  if (i >= 0) expandedKeys.value = expandedKeys.value.filter((k) => k !== key)
  else expandedKeys.value = [...expandedKeys.value, key]
}

/**
 * 拖拽放置：
 *   - dropPosition === 0 且 drop 在 FOLDER 上 → 进入该文件夹
 *   - 其它情况（DOC / 兄弟位置）→ 落到 drop 目标的父节点
 */
async function onDrop(info: any): Promise<void> {
  const dragNode = info?.dragNode?.dataRef as DocTreeItem | undefined
  const dropNode = info?.node?.dataRef as DocTreeItem | undefined
  if (!dragNode || !dropNode) return
  const dropToGap = info.dropToGap as boolean

  let newParentId: number | null
  if (!dropToGap && dropNode.type === 'FOLDER') {
    newParentId = dropNode.key
  } else {
    newParentId = dropNode.parentId
  }

  if (dragNode.parentId === newParentId) return

  try {
    await store.update(dragNode.key, { parentId: newParentId })
    notify.success(`已移动 "${dragNode.title}"`)
  } catch (err) {
    notify.error((err as Error).message)
  }
}

/** 右键菜单当前的目标节点 */
const ctxNode = ref<DocTreeItem | null>(null)

function onRightClick(info: any): void {
  const item = info?.node?.dataRef as DocTreeItem | undefined
  if (item) ctxNode.value = item
  ;(info?.event as MouseEvent | undefined)?.preventDefault()
}

// ── 操作 handlers ─────────────────────────────────────────

function openCreate(parentId: number | null, isFolder: boolean): void {
  dialog.value = {
    mode: isFolder ? 'create-folder' : 'create-doc',
    parentId,
  }
  dialogOpen.value = true
}

function openRename(node: DocTreeItem): void {
  dialog.value = {
    mode: 'rename',
    parentId: node.parentId,
    nodeId: node.key,
    initialName: node.title,
  }
  dialogOpen.value = true
}

async function onRemove(node: DocTreeItem): Promise<void> {
  if (
    !(await confirm({
      title: '删除节点',
      content: `删除 "${node.title}" 后将进入回收站（30 天内可恢复），是否继续？`,
      danger: true,
    }))
  ) {
    return
  }
  try {
    await store.remove(node.key)
    notify.success(`已删除 "${node.title}"`)
  } catch (err) {
    notify.error((err as Error).message)
  }
}

async function onDialogSubmit(payload: { name: string }): Promise<void> {
  const ctx = dialog.value
  if (!ctx) return
  try {
    if (ctx.mode === 'rename' && ctx.nodeId !== undefined) {
      await store.update(ctx.nodeId, { name: payload.name })
    } else {
      await store.create({
        parentId: ctx.parentId,
        type: ctx.mode === 'create-folder' ? 'FOLDER' : 'DOC',
        name: payload.name,
      })
    }
    notify.success(ctx.mode === 'rename' ? '已重命名' : '已创建')
    dialog.value = null
  } catch (err) {
    notify.error((err as Error).message)
  }
}

// 让模板能直接拿到，避免 v-if 用 h() 的笨重
function iconFor(item: DocTreeItem): unknown {
  if (item.type === 'DOC') return h(FileTextOutlined)
  return expandedKeys.value.includes(item.key)
    ? h(FolderOpenOutlined)
    : h(FolderOutlined)
}
</script>

<template>
  <aside class="doc-tree">
    <header class="header" @click="collapsed = !collapsed">
      <span class="collapse-icon">
        <DownOutlined v-if="!collapsed" />
        <RightOutlined v-else />
      </span>
      <span class="title">{{ props.title }}</span>
      <a-space v-if="!props.readonly && !collapsed" :size="4" @click.stop>
        <a-tooltip title="根级新建文件夹">
          <a-button size="small" @click="openCreate(null, true)">
            <template #icon><PlusOutlined /></template>
            文件夹
          </a-button>
        </a-tooltip>
        <a-tooltip title="根级新建文档">
          <a-button size="small" type="primary" @click="openCreate(null, false)">
            <template #icon><PlusOutlined /></template>
            文档
          </a-button>
        </a-tooltip>
        <a-tooltip title="导入 .md / .zip">
          <a-button size="small" @click="emit('import-here', null)">
            <template #icon><ImportOutlined /></template>
          </a-button>
        </a-tooltip>
      </a-space>
    </header>

    <template v-if="!collapsed">
      <div v-if="store.loading" class="empty">加载中 …</div>
      <a-empty
        v-else-if="!hasTree"
        class="empty"
        :description="props.readonly ? '还没有人分享文档给你' : '还没有任何文档'"
      />

      <a-tree
        v-else
        class="tree"
        :tree-data="treeItems"
        v-model:expandedKeys="expandedKeys"
        v-model:selectedKeys="selectedKeys"
        :block-node="true"
        :draggable="!props.readonly"
        :show-icon="false"
        :show-line="true"
        @select="onSelect"
        @drop="onDrop"
        @rightClick="onRightClick"
      >
      <template #title="item">
        <a-dropdown :trigger="['contextmenu']">
          <span class="node-title">
            <component :is="iconFor(item)" class="node-icon" />
            <span class="node-name">{{ item.title }}</span>
            <span v-if="!props.readonly" class="node-actions">
              <a-tooltip v-if="item.type === 'FOLDER'" title="在此新建文件夹">
                <a-button
                  size="small"
                  type="text"
                  @click.stop="openCreate(item.key, true)"
                >📁+</a-button>
              </a-tooltip>
              <a-tooltip v-if="item.type === 'FOLDER'" title="在此新建文档">
                <a-button
                  size="small"
                  type="text"
                  @click.stop="openCreate(item.key, false)"
                >📄+</a-button>
              </a-tooltip>
              <a-tooltip title="分享">
                <a-button
                  size="small"
                  type="text"
                  @click.stop="emit('share', item.raw)"
                >🔗</a-button>
              </a-tooltip>
              <a-tooltip title="重命名">
                <a-button
                  size="small"
                  type="text"
                  @click.stop="openRename(item)"
                >✎</a-button>
              </a-tooltip>
              <a-tooltip title="删除">
                <a-button
                  size="small"
                  type="text"
                  danger
                  @click.stop="onRemove(item)"
                >×</a-button>
              </a-tooltip>
            </span>
          </span>
          <template #overlay>
            <a-menu @click="() => (ctxNode = item)">
              <template v-if="!props.readonly && item.type === 'FOLDER'">
                <a-menu-item key="new-folder" @click="openCreate(item.key, true)">
                  新建文件夹
                </a-menu-item>
                <a-menu-item key="new-doc" @click="openCreate(item.key, false)">
                  新建文档
                </a-menu-item>
                <a-menu-item key="import" @click="emit('import-here', item.key)">
                  导入到此处
                </a-menu-item>
                <a-menu-divider />
              </template>
              <a-menu-item key="share" @click="emit('share', item.raw)">分享</a-menu-item>
              <template v-if="!props.readonly">
                <a-menu-item key="rename" @click="openRename(item)">重命名</a-menu-item>
                <a-menu-item key="delete" danger @click="onRemove(item)">删除</a-menu-item>
              </template>
            </a-menu>
          </template>
        </a-dropdown>
      </template>
    </a-tree>
    </template>

    <NewNodeDialog
      v-if="dialog"
      v-model:open="dialogOpen"
      :mode="dialog.mode"
      :parent-id="dialog.parentId"
      :node-id="dialog.nodeId"
      :initial-name="dialog.initialName"
      @submit="onDialogSubmit"
    />
  </aside>
</template>

<style scoped>
.doc-tree {
  width: 280px;
  height: 100%;
  overflow: auto;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
  cursor: pointer;
  user-select: none;
}
.collapse-icon {
  font-size: 0.7em;
  color: var(--text-tertiary);
  margin-right: 0.3rem;
  flex: 0 0 auto;
}
.title {
  font-weight: 600;
  color: var(--text-secondary);
  flex: 1;
}
.empty {
  padding: 1.5rem 1rem;
  color: var(--text-tertiary);
  font-size: 0.85rem;
}
.tree {
  background: transparent;
  padding: 0.25rem 0;
}
.node-title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
}
.node-icon {
  color: var(--text-tertiary);
  flex: 0 0 auto;
}
.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-actions {
  display: none;
  align-items: center;
  gap: 0;
  flex: 0 0 auto;
}
.node-title:hover .node-actions {
  display: inline-flex;
}
.node-actions :deep(.ant-btn) {
  padding: 0 4px;
  height: 22px;
  font-size: 0.85em;
}
/* 虚线连接：show-line 实线改虚线 */
.tree :deep(.ant-tree-indent-unit::before) {
  border-inline-end-style: dashed !important;
}
.tree :deep(.ant-tree-switcher-leaf-line::before) {
  border-inline-end-style: dashed !important;
}
.tree :deep(.ant-tree-switcher-leaf-line::after) {
  border-bottom-style: dashed !important;
}
</style>
