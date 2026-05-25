<script setup lang="ts">
/**
 * 编辑器壳 — CodeMirror 6 + y-codemirror.next + Hocuspocus + 实时预览
 * by AI.Coding
 *
 * 布局：
 *   ┌────────────────────────────────────────────┐
 *   │  标题栏（含 "👁 预览" 切换按钮）             │
 *   ├────────────────────────────────────────────┤
 *   │  PresenceBar / Toolbar                     │
 *   ├──────────────────┬─────────────────────────┤
 *   │  CodeMirror 编辑 │  Markdown 实时预览       │
 *   │  （markdown 源） │  （HTML 渲染）           │
 *   └──────────────────┴─────────────────────────┘
 *
 * 设计要点：
 *   - markdown 源直接作为协同内容（yjs Y.Text('markdown')）
 *   - 远程光标 / 选区由 y-codemirror.next 基于 awareness.user 自动渲染
 *   - 预览：监听 ytext.observe → debounce 100ms 更新 currentMarkdown → PreviewPane 重新 render
 *   - 预览可切换显示/隐藏（标题栏按钮）；默认开
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  DownloadOutlined,
  EyeOutlined,
  FilePdfOutlined,
  HistoryOutlined,
} from '@ant-design/icons-vue'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import {
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
} from '@codemirror/language'
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { yCollab } from 'y-codemirror.next'
import * as Y from 'yjs'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import PresenceBar from './PresenceBar.vue'
import PreviewPane from './PreviewPane.vue'
import Toolbar from './Toolbar.vue'
import VersionPanel from '@/components/VersionPanel/VersionPanel.vue'
import { imageUploadExtension } from './imageUpload'
import { htmlPasteExtension } from './htmlPaste'
import { typoraExtensionsDark, typoraExtensionsLight } from './typora-theme'
import { createCollabProvider } from '@/api/ws'
import { imexportApi } from '@/api/imexport.api'
import { useCurrentUserStore } from '@/stores/currentUser'
import { useCollabPresenceStore } from '@/stores/collabPresence'
import { useThemeStore } from '@/stores/theme'
import { pickColor } from '@/utils/avatar'

const props = defineProps<{
  docId: number
  docName: string
}>()

const userStore = useCurrentUserStore()
const presenceStore = useCollabPresenceStore()
const themeStore = useThemeStore()

const containerRef = ref<HTMLDivElement | null>(null)
const previewRef = ref<{ scrollToLine: (line: number) => void } | null>(null)
const view = shallowRef<EditorView | null>(null)
const provider = shallowRef<HocuspocusProvider | null>(null)
const ydoc = shallowRef<Y.Doc | null>(null)

/** 预览可见性（默认开） */
const showPreview = ref(true)
/** 版本面板显隐 */
const showVersion = ref(false)
/** 给 PreviewPane 的当前 markdown 文本（由 ytext.observe 更新） */
const currentMarkdown = ref('')
/** Ctrl+S 触发后短暂显示"已保存"提示 */
const savedFlash = ref(false)
let savedFlashTimer: ReturnType<typeof setTimeout> | null = null

/** Compartment：动态切换 editable */
const editableCompartment = new Compartment()
/** Compartment：动态切换亮/暗主题 */
const themeCompartment = new Compartment()
/** 监听 ytext 变化的清理函数 */
let unobserveYtext: (() => void) | null = null
let previewDebounce: ReturnType<typeof setTimeout> | null = null
/** 编辑器 → 预览滚动同步节流 */
let syncDebounce: ReturnType<typeof setTimeout> | null = null
/** scrollDOM 的 scroll 事件清理 */
let detachScrollListener: (() => void) | null = null

onMounted(() => {
  setup()
  // 全局兜底：哪怕焦点不在 CodeMirror 上，也吞掉浏览器 Ctrl+S
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  cleanup()
  window.removeEventListener('keydown', onGlobalKeydown)
})

watch(
  () => props.docId,
  () => {
    cleanup()
    setup()
  },
)

function setup(): void {
  if (!userStore.user || !containerRef.value) return
  presenceStore.reset()

  const me = userStore.user
  const baseColor = pickColor(me.userId)
  const { ydoc: doc, provider: p } = createCollabProvider(
    props.docId,
    { userId: me.userId, name: me.displayName, color: baseColor },
    (status) => presenceStore.setStatus(status),
  )
  ydoc.value = doc
  provider.value = p

  p.awareness?.on('change', () => syncPresences(p))
  syncPresences(p)

  p.on('synced', () => {
    const ro = Boolean(
      (p as unknown as { connection?: { readOnly?: boolean } }).connection?.readOnly,
    )
    presenceStore.setReadOnly(ro)
    applyEditable(!ro)
    // sync 后取一次初始 markdown 给预览
    currentMarkdown.value = doc.getText('markdown').toString()
  })

  const ytext = doc.getText('markdown')
  const undoManager = new Y.UndoManager(ytext)

  // 监听 ytext 变化，debounce 100ms 后更新 preview（避免每个 keystroke 都重渲染）
  const observer = (): void => {
    if (previewDebounce) clearTimeout(previewDebounce)
    previewDebounce = setTimeout(() => {
      currentMarkdown.value = ytext.toString()
    }, 100)
  }
  ytext.observe(observer)
  unobserveYtext = () => ytext.unobserve(observer)
  // 初始值
  currentMarkdown.value = ytext.toString()

  const state = EditorState.create({
    doc: ytext.toString(),
    extensions: [
      lineNumbers(),
      foldGutter(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),

      history(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      highlightSelectionMatches(),

      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
        // 拦截浏览器默认的 Ctrl+S/Cmd+S 保存弹窗。
        // 协同模式下内容已经由 Hocuspocus 自动持久化，这里只是给用户一个"已保存"反馈。
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            triggerSavedFlash()
            return true
          },
        },
      ]),

      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      themeCompartment.of(
        themeStore.applied === 'dark' ? typoraExtensionsDark : typoraExtensionsLight,
      ),
      // 图片粘贴/拖拽上传（按当前文档 id 关联）
      imageUploadExtension(props.docId),
      // 其它富文本粘贴转 markdown（在图片处理之后，避免与 image 流冲突）
      htmlPasteExtension(),
      // 光标移动 / 选区变化 → 同步预览到光标所在行
      EditorView.updateListener.of((update) => {
        if (update.selectionSet) {
          const head = update.state.selection.main.head
          const line0 = update.state.doc.lineAt(head).number - 1
          scheduleSync(line0)
        }
      }),
      yCollab(ytext, p.awareness, { undoManager }),
      editableCompartment.of(EditorView.editable.of(true)),
    ],
  })

  view.value = new EditorView({
    state,
    parent: containerRef.value,
  })

  // 编辑器自身滚动 → 同步预览：取顶部可见块对应的行
  attachScrollSync(view.value)
}

function cleanup(): void {
  if (previewDebounce) {
    clearTimeout(previewDebounce)
    previewDebounce = null
  }
  if (syncDebounce) {
    clearTimeout(syncDebounce)
    syncDebounce = null
  }
  if (savedFlashTimer) {
    clearTimeout(savedFlashTimer)
    savedFlashTimer = null
  }
  if (detachScrollListener) {
    detachScrollListener()
    detachScrollListener = null
  }
  if (unobserveYtext) {
    unobserveYtext()
    unobserveYtext = null
  }
  if (view.value) {
    view.value.destroy()
    view.value = null
  }
  if (provider.value) {
    provider.value.destroy()
    provider.value = null
  }
  if (ydoc.value) {
    ydoc.value.destroy()
    ydoc.value = null
  }
  presenceStore.reset()
  currentMarkdown.value = ''
}

/** 节流转发到 PreviewPane（光标 / 滚动都会调） */
function scheduleSync(line0: number): void {
  if (!showPreview.value) return
  if (syncDebounce) clearTimeout(syncDebounce)
  syncDebounce = setTimeout(() => {
    previewRef.value?.scrollToLine(line0)
  }, 40)
}

/** 监听编辑器 scrollDOM 的原生 scroll，取顶部可见块对应的源行 */
function attachScrollSync(v: EditorView): void {
  const dom = v.scrollDOM
  const onScroll = (): void => {
    try {
      // 滚到最顶时，直接当作第 0 行，避免视口顶部还在前几行的"渲染缓冲"里
      if (dom.scrollTop <= 2) {
        scheduleSync(0)
        return
      }
      const rect = dom.getBoundingClientRect()
      // 探测点：编辑器视口顶部偏一点，水平方向跳过行号 gutter
      const pos = v.posAtCoords({ x: rect.left + 60, y: rect.top + 4 })
      const line0 =
        pos != null
          ? v.state.doc.lineAt(pos).number - 1
          : v.state.doc.lineAt(v.viewport.from).number - 1
      scheduleSync(line0)
    } catch {
      // 文档为空 / 还未布局完成时静默忽略
    }
  }
  dom.addEventListener('scroll', onScroll, { passive: true })
  detachScrollListener = () => dom.removeEventListener('scroll', onScroll)
}

function applyEditable(editable: boolean): void {
  if (!view.value) return
  view.value.dispatch({
    effects: editableCompartment.reconfigure(EditorView.editable.of(editable)),
  })
}

function syncPresences(p: HocuspocusProvider): void {
  const states = p.awareness?.getStates()
  if (!states) {
    presenceStore.setPresences([])
    return
  }
  const list: { clientId: number; userId: number; name: string; color: string }[] = []
  for (const [clientId, state] of states.entries()) {
    const u = (state as { user?: { userId: number; name: string; color: string } }).user
    if (!u) continue
    list.push({ clientId, userId: u.userId, name: u.name, color: u.color })
  }
  const seen = new Set<number>()
  const deduped = list.filter((entry) => {
    if (seen.has(entry.userId)) return false
    seen.add(entry.userId)
    return true
  })
  presenceStore.setPresences(deduped)
}

watch(
  () => presenceStore.readOnly,
  (ro) => applyEditable(!ro),
)

// 主题切换时，热更换 CodeMirror theme（不丢光标 / 选区 / 撤销栈）
watch(
  () => themeStore.applied,
  (applied) => {
    if (!view.value) return
    view.value.dispatch({
      effects: themeCompartment.reconfigure(
        applied === 'dark' ? typoraExtensionsDark : typoraExtensionsLight,
      ),
    })
  },
)

function togglePreview(): void {
  showPreview.value = !showPreview.value
}

function openVersion(): void {
  showVersion.value = true
}

function exportMd(): void {
  // 触发浏览器下载（自带 cookie，后端验证 READ 权限）
  window.location.href = imexportApi.exportMdUrl(props.docId)
}

function exportPdf(): void {
  window.location.href = imexportApi.exportPdfUrl(props.docId)
}

/** Ctrl+S 触发；协同模式下内容已自动落库，仅展示一次"已保存"提示 */
function triggerSavedFlash(): void {
  savedFlash.value = true
  if (savedFlashTimer) clearTimeout(savedFlashTimer)
  savedFlashTimer = setTimeout(() => {
    savedFlash.value = false
  }, 1200)
}

/** 全局 keydown：捕获 Ctrl+S / Cmd+S，阻止浏览器默认保存弹窗 */
function onGlobalKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
    event.preventDefault()
    triggerSavedFlash()
  }
}
</script>

<template>
  <div class="editor-shell">
    <div class="title-bar">
      <span class="doc-name">{{ docName }}</span>
      <Transition name="fade">
        <a-tag v-if="savedFlash" color="success" class="saved-tag">✓ 已保存</a-tag>
      </Transition>
      <a-space class="title-actions" :size="6">
        <a-button @click="openVersion">
          <template #icon><HistoryOutlined /></template>
          版本
        </a-button>
        <a-button @click="exportMd">
          <template #icon><DownloadOutlined /></template>
          MD
        </a-button>
        <a-button @click="exportPdf">
          <template #icon><FilePdfOutlined /></template>
          PDF
        </a-button>
        <a-button :type="showPreview ? 'primary' : 'default'" @click="togglePreview">
          <template #icon><EyeOutlined /></template>
          {{ showPreview ? '预览开' : '预览关' }}
        </a-button>
      </a-space>
    </div>
    <PresenceBar />
    <Toolbar :view="view" />
    <div class="editor-body" :class="{ 'with-preview': showPreview }">
      <div ref="containerRef" class="cm-container" />
      <PreviewPane
        v-if="showPreview"
        ref="previewRef"
        :markdown="currentMarkdown"
        class="preview-half"
      />
    </div>
    <VersionPanel
      v-if="showVersion"
      :doc-id="docId"
      :doc-name="docName"
      @close="showVersion = false"
    />
  </div>
</template>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}
.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}
.doc-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}
.title-actions {
  display: flex;
  gap: 0.4rem;
}
.saved-tag {
  margin-left: 0.75rem !important;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.cm-container {
  flex: 1;
  overflow: auto;
  min-width: 0; /* 防止 flex 子项撑出父容器 */
}
.editor-body.with-preview .cm-container {
  border-right: 1px solid var(--border-color);
}
.preview-half {
  flex: 1;
  min-width: 0;
}
</style>

<style>
.cm-container > .cm-editor {
  height: 100%;
}
.cm-container > .cm-editor.cm-focused {
  outline: none;
}
</style>
