<script setup lang="ts">
/**
 * 编辑器工具栏 — CodeMirror 版本
 * by AI.Coding
 *
 * 按钮通过 EditorView.dispatch 插入 markdown 语法，让用户既能用工具栏
 * 也能直接打字（Typora 风格）。
 *
 * 链接插入用 a-modal 替代原来的 window.prompt。
 */
import { ref } from 'vue'
import type { EditorView } from '@codemirror/view'

const props = defineProps<{
  view: EditorView | null
}>()

/** 链接对话框状态 */
const linkModalOpen = ref(false)
const linkUrl = ref('')
const linkText = ref('')

function wrapSelection(prefix: string, suffix: string = prefix): void {
  const v = props.view
  if (!v) return
  const sel = v.state.selection.main
  const selText = v.state.doc.sliceString(sel.from, sel.to)
  v.dispatch({
    changes: { from: sel.from, to: sel.to, insert: `${prefix}${selText}${suffix}` },
    selection: { anchor: sel.from + prefix.length, head: sel.to + prefix.length },
  })
  v.focus()
}

function prefixLine(text: string): void {
  const v = props.view
  if (!v) return
  const sel = v.state.selection.main
  const line = v.state.doc.lineAt(sel.from)
  v.dispatch({
    changes: { from: line.from, insert: text },
    selection: { anchor: sel.from + text.length },
  })
  v.focus()
}

function insertAtCursor(text: string): void {
  const v = props.view
  if (!v) return
  const sel = v.state.selection.main
  v.dispatch({
    changes: { from: sel.from, to: sel.to, insert: text },
    selection: { anchor: sel.from + text.length },
  })
  v.focus()
}

function setH1(): void { prefixLine('# ') }
function setH2(): void { prefixLine('## ') }
function setH3(): void { prefixLine('### ') }
function toggleBold(): void { wrapSelection('**') }
function toggleItalic(): void { wrapSelection('*') }
function toggleStrike(): void { wrapSelection('~~') }
function toggleInlineCode(): void { wrapSelection('`') }
function insertCodeBlock(): void { insertAtCursor('\n```\n\n```\n') }
function insertBulletList(): void { prefixLine('- ') }
function insertOrderedList(): void { prefixLine('1. ') }
function insertQuote(): void { prefixLine('> ') }
function insertHorizontalRule(): void { insertAtCursor('\n\n---\n\n') }
function insertTable(): void {
  insertAtCursor('\n| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n| 单元格 | 单元格 | 单元格 |\n')
}
function insertTaskItem(): void { prefixLine('- [ ] ') }

function openLinkModal(): void {
  // 取当前选区文本作为链接默认文字
  const v = props.view
  if (v) {
    const sel = v.state.selection.main
    linkText.value = v.state.doc.sliceString(sel.from, sel.to)
  } else {
    linkText.value = ''
  }
  linkUrl.value = ''
  linkModalOpen.value = true
}

function confirmLink(): void {
  const url = linkUrl.value.trim()
  if (!url) {
    linkModalOpen.value = false
    return
  }
  const v = props.view
  if (!v) return
  const sel = v.state.selection.main
  const text = linkText.value.trim() || url
  v.dispatch({
    changes: { from: sel.from, to: sel.to, insert: `[${text}](${url})` },
    selection: { anchor: sel.from + text.length + url.length + 4 },
  })
  v.focus()
  linkModalOpen.value = false
}
</script>

<template>
  <div class="toolbar">
    <a-space :size="4" wrap>
      <a-tooltip title="一级标题">
        <a-button size="small" @click="setH1">H1</a-button>
      </a-tooltip>
      <a-tooltip title="二级标题">
        <a-button size="small" @click="setH2">H2</a-button>
      </a-tooltip>
      <a-tooltip title="三级标题">
        <a-button size="small" @click="setH3">H3</a-button>
      </a-tooltip>
      <a-divider type="vertical" />

      <a-tooltip title="加粗">
        <a-button size="small" @click="toggleBold"><b>B</b></a-button>
      </a-tooltip>
      <a-tooltip title="斜体">
        <a-button size="small" @click="toggleItalic"><i>I</i></a-button>
      </a-tooltip>
      <a-tooltip title="删除线">
        <a-button size="small" @click="toggleStrike"><s>S</s></a-button>
      </a-tooltip>
      <a-divider type="vertical" />

      <a-tooltip title="无序列表">
        <a-button size="small" @click="insertBulletList">• 列表</a-button>
      </a-tooltip>
      <a-tooltip title="有序列表">
        <a-button size="small" @click="insertOrderedList">1. 列表</a-button>
      </a-tooltip>
      <a-tooltip title="任务列表">
        <a-button size="small" @click="insertTaskItem">☐ 任务</a-button>
      </a-tooltip>
      <a-tooltip title="引用">
        <a-button size="small" @click="insertQuote">"</a-button>
      </a-tooltip>
      <a-divider type="vertical" />

      <a-tooltip title="行内代码">
        <a-button size="small" @click="toggleInlineCode">⟨/⟩</a-button>
      </a-tooltip>
      <a-tooltip title="代码块">
        <a-button size="small" @click="insertCodeBlock">```</a-button>
      </a-tooltip>
      <a-tooltip title="分隔线">
        <a-button size="small" @click="insertHorizontalRule">—</a-button>
      </a-tooltip>
      <a-tooltip title="表格">
        <a-button size="small" @click="insertTable">⊞</a-button>
      </a-tooltip>
      <a-divider type="vertical" />

      <a-tooltip title="插入链接">
        <a-button size="small" @click="openLinkModal">🔗</a-button>
      </a-tooltip>
    </a-space>

    <a-modal
      v-model:open="linkModalOpen"
      title="插入链接"
      ok-text="插入"
      cancel-text="取消"
      :destroy-on-close="true"
      @ok="confirmLink"
    >
      <a-form layout="vertical">
        <a-form-item label="显示文字">
          <a-input v-model:value="linkText" placeholder="显示的文字（可选）" />
        </a-form-item>
        <a-form-item label="链接地址">
          <a-input
            v-model:value="linkUrl"
            placeholder="https://..."
            @pressEnter="confirmLink"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.toolbar {
  padding: 0.5rem 1rem;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}
</style>
