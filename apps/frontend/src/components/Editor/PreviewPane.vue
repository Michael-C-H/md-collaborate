<script setup lang="ts">
/**
 * Markdown 实时预览面板
 * by AI.Coding
 *
 * 接收 markdown 字符串，渲染为安全 HTML 显示。
 * 渲染：markdown-it（GFM 风格 + 任务列表）+ highlight.js 代码块高亮。
 *
 * 安全：markdown-it 配置 `html: false`，原始 HTML 标签被当作文本处理，
 * 不会让 markdown 内嵌的 `<script>` 之类执行。
 *
 * 编辑器联动：所有 level=0 的块级 token（标题/段落/列表/代码块等）渲染时
 * 都会附带 `data-source-line`（0-based 源行号）。EditorShell 通过 ref 调
 * `scrollToLine()` 把预览定位到对应位置。
 */
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github.css'

const props = defineProps<{
  markdown: string
}>()

const rootRef = ref<HTMLElement | null>(null)

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight: (code: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`
      } catch {
        // 高亮失败 → 退回纯文本（下面继续走）
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`
  },
})
md.use(taskLists, { enabled: true })

interface MdToken {
  map: [number, number] | null
  level: number
  type: string
  attrSet: (name: string, value: string) => void
}

// 给顶层块 token 加 data-source-line（用于编辑器 → 预览的滚动同步）
md.core.ruler.push('source-line', (state: { tokens: MdToken[] }) => {
  for (const tok of state.tokens) {
    if (tok.map && tok.level === 0 && tok.type.endsWith('_open')) {
      tok.attrSet('data-source-line', String(tok.map[0]))
    }
  }
})

const html = computed(() => md.render(props.markdown || ''))

/**
 * 滚动预览到 0-based 源行号对应的块级元素位置。
 * 找不到精确匹配时用 <= line 的最近一个块作为锚点。
 *
 * 用 getBoundingClientRect 计算偏移，不依赖 offsetParent，避开 .preview-pane
 * 不是 positioned 时 offsetTop 失真的问题。
 */
function scrollToLine(line: number): void {
  const root = rootRef.value
  if (!root) return
  if (line <= 0) {
    root.scrollTo({ top: 0, behavior: 'auto' })
    return
  }
  const elements = root.querySelectorAll<HTMLElement>('[data-source-line]')
  if (elements.length === 0) return

  let anchor: HTMLElement | null = null
  for (const el of elements) {
    const l = Number(el.dataset['sourceLine'])
    if (!Number.isFinite(l)) continue
    if (l <= line) anchor = el
    else break
  }
  if (!anchor) anchor = elements[0] as HTMLElement

  const rootRect = root.getBoundingClientRect()
  const anchorRect = anchor.getBoundingClientRect()
  // anchor 相对于 root 滚动顶端的偏移
  const offset = anchorRect.top - rootRect.top + root.scrollTop
  const target = Math.max(0, offset - 12)
  root.scrollTo({ top: target, behavior: 'auto' })
}

defineExpose({ scrollToLine })
</script>

<template>
  <article ref="rootRef" class="preview-pane markdown-body" v-html="html" />
</template>

<style scoped>
.preview-pane {
  /* border-box：避免 padding 让总高度超过 100%，导致底部被外层 overflow:hidden 裁掉 */
  box-sizing: border-box;
  /* position:relative：让内部块级元素的 offsetTop / 几何计算有清晰的参考系 */
  position: relative;
  height: 100%;
  overflow: auto;
  padding: 1.25rem 2rem;
  background: var(--bg-primary);
  font-size: 15px;
  line-height: 1.75;
  color: var(--text-primary);
}
</style>

<style>
/* markdown-body 风格（GitHub 简化版）；不加 scoped 让 v-html 节点能继承样式 */
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin: 1.2em 0 0.6em;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-primary);
}
.markdown-body h1 { font-size: 1.8em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
.markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1.1em; }
.markdown-body p { margin: 0.75em 0; }
.markdown-body a { color: #4a9eda; text-decoration: underline; }
.markdown-body strong { font-weight: 700; }
.markdown-body em { font-style: italic; }
.markdown-body del { color: var(--text-tertiary); text-decoration: line-through; }
.markdown-body blockquote {
  margin: 0.75em 0;
  padding: 0 1rem;
  border-left: 4px solid var(--border-strong);
  color: var(--text-secondary);
}
.markdown-body ul,
.markdown-body ol { padding-left: 1.5rem; margin: 0.5em 0; }
.markdown-body li { margin: 0.2em 0; }
.markdown-body li input[type='checkbox'] {
  margin-right: 0.4em;
  vertical-align: middle;
}
.markdown-body code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 0.9em;
  background: var(--bg-tertiary);
  padding: 0.1em 0.4em;
  border-radius: 3px;
  color: #c7254e;
}
[data-theme='dark'] .markdown-body code { color: #ff7b9d; }
.markdown-body pre {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 1rem;
  overflow: auto;
  margin: 0.75em 0;
}
.markdown-body pre code {
  background: transparent;
  padding: 0;
  color: inherit;
  font-size: 0.85em;
}
.markdown-body table {
  border-collapse: collapse;
  margin: 0.75em 0;
  display: block;
  overflow: auto;
}
.markdown-body table th,
.markdown-body table td {
  border: 1px solid var(--border-color);
  padding: 0.4em 0.8em;
}
.markdown-body table th {
  background: var(--bg-tertiary);
  font-weight: 600;
}
.markdown-body hr {
  border: none;
  border-top: 2px solid var(--border-color);
  margin: 1.5em 0;
}
.markdown-body img {
  max-width: 100%;
  height: auto;
}

/* highlight.js GitHub 样式默认是亮色，dark 模式下用最小补丁覆盖关键 token */
[data-theme='dark'] .markdown-body .hljs {
  color: #c9d1d9;
  background: var(--bg-tertiary);
}
[data-theme='dark'] .markdown-body .hljs-keyword,
[data-theme='dark'] .markdown-body .hljs-built_in,
[data-theme='dark'] .markdown-body .hljs-literal {
  color: #ff7b72;
}
[data-theme='dark'] .markdown-body .hljs-string,
[data-theme='dark'] .markdown-body .hljs-meta-string {
  color: #a5d6ff;
}
[data-theme='dark'] .markdown-body .hljs-number,
[data-theme='dark'] .markdown-body .hljs-symbol {
  color: #79c0ff;
}
[data-theme='dark'] .markdown-body .hljs-comment,
[data-theme='dark'] .markdown-body .hljs-quote {
  color: #8b949e;
  font-style: italic;
}
[data-theme='dark'] .markdown-body .hljs-title,
[data-theme='dark'] .markdown-body .hljs-title.function_ {
  color: #d2a8ff;
}
[data-theme='dark'] .markdown-body .hljs-attr,
[data-theme='dark'] .markdown-body .hljs-name,
[data-theme='dark'] .markdown-body .hljs-tag {
  color: #79c0ff;
}
[data-theme='dark'] .markdown-body .hljs-variable,
[data-theme='dark'] .markdown-body .hljs-params {
  color: #e6edf3;
}
</style>
