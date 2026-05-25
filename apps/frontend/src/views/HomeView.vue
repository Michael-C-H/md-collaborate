<script setup lang="ts">
/**
 * 首页 — 左侧文档树 + 右侧编辑器（+ 分享面板 / 导入对话框）
 * by AI.Coding
 */
import { computed, onMounted, ref } from 'vue'
import type { NodeTreeVO } from '@app/shared'
import DocTree from '@/components/DocTree/DocTree.vue'
import EditorShell from '@/components/Editor/EditorShell.vue'
import SharePanel from '@/components/SharePanel/SharePanel.vue'
import ImportDialog from '@/components/ImExport/ImportDialog.vue'
import { useDocTreeStore } from '@/stores/docTree'
import { useCurrentUserStore } from '@/stores/currentUser'

const docTreeStore = useDocTreeStore()
const currentUserStore = useCurrentUserStore()
const isAdmin = computed(() => currentUserStore.user?.role === 'ADMIN')
const currentDoc = ref<{ id: number; name: string } | null>(null)

onMounted(async () => {
  await docTreeStore.refresh()
})
const shareTarget = ref<NodeTreeVO | null>(null)
const importDialogParent = ref<number | null | undefined>(undefined)

function onOpenDoc(payload: { id: number; name: string }): void {
  currentDoc.value = payload
}

function onShare(node: NodeTreeVO): void {
  shareTarget.value = node
}

function onImportHere(parentId: number | null): void {
  importDialogParent.value = parentId
}

function onImported(): void {
  // 导入成功后刷新文档树
  void docTreeStore.refresh()
}
</script>

<template>
  <div class="home">
    <aside class="tree-sidebar">
      <DocTree
        title="我的文档"
        :tree-data="docTreeStore.myTree"
        @open-doc="onOpenDoc"
        @share="onShare"
        @import-here="onImportHere"
      />
      <DocTree
        title="共享给我"
        :tree-data="docTreeStore.sharedTree"
        readonly
        default-collapsed
        @open-doc="onOpenDoc"
        @share="onShare"
      />
      <DocTree
        v-if="isAdmin"
        title="他人文档"
        :tree-data="docTreeStore.othersTree"
        readonly
        default-collapsed
        @open-doc="onOpenDoc"
        @share="onShare"
      />
    </aside>

    <section class="content">
      <EditorShell
        v-if="currentDoc"
        :key="currentDoc.id"
        :doc-id="currentDoc.id"
        :doc-name="currentDoc.name"
      />
      <div v-else class="empty">从左侧文档树打开一个文档，或新建一个开始</div>
    </section>

    <SharePanel
      v-if="shareTarget"
      :node-id="shareTarget.id"
      :node-name="shareTarget.name"
      @close="shareTarget = null"
    />

    <ImportDialog
      v-if="importDialogParent !== undefined"
      :parent-id="importDialogParent"
      @close="importDialogParent = undefined"
      @imported="onImported"
    />
  </div>
</template>

<style scoped>
.home {
  display: flex;
  height: 100%;
}
.tree-sidebar {
  width: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid var(--border-color);
}
.tree-sidebar :deep(.doc-tree) {
  flex: none;
  height: auto;
  width: 100%;
  border-right: none;
  overflow-x: hidden;
}
.tree-sidebar :deep(.doc-tree:not(:last-child)) {
  border-bottom: 1px solid var(--border-color);
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #aaa;
}
</style>
