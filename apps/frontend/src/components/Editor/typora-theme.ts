/**
 * Typora 风格 CodeMirror 主题（亮 / 暗 双套）
 * by AI.Coding
 *
 * 让 markdown 源码呈现"所见即所得"：
 *   - 标题：字号递增 + 加粗
 *   - 加粗 / 斜体 / 删除线 / 链接 / 行内代码：直接渲染
 *   - 符号本身（#、**、`）保留显示，但色彩调浅成"元字符"
 *
 * 选区 / 协作者光标：
 *   - 本地选区：rgba 半透明 + selectionLayer 提到 content 上方，跨行可见
 *   - 远程光标：y-codemirror.next 基于 awareness.user 自动渲染
 *
 * 暴露：
 *   typoraExtensionsLight  亮色主题 + 高亮
 *   typoraExtensionsDark   暗色主题 + 高亮
 */
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

// ── 高亮（亮）─────────────────────────────────────────
const markdownHighlightLight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.8em', fontWeight: '700', color: '#222' },
  { tag: t.heading2, fontSize: '1.5em', fontWeight: '700', color: '#222' },
  { tag: t.heading3, fontSize: '1.25em', fontWeight: '700', color: '#222' },
  { tag: t.heading4, fontSize: '1.1em', fontWeight: '700', color: '#333' },
  { tag: t.heading5, fontSize: '1em', fontWeight: '700', color: '#333' },
  { tag: t.heading6, fontSize: '1em', fontWeight: '700', color: '#555' },

  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#999' },

  { tag: t.link, color: '#1f77b4' },
  { tag: t.url, color: '#1f77b4', textDecoration: 'underline' },

  {
    tag: t.monospace,
    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", monospace',
    background: '#f5f5f5',
    color: '#c7254e',
    padding: '0 4px',
    borderRadius: '3px',
  },

  { tag: t.quote, color: '#888', fontStyle: 'italic' },
  { tag: t.list, color: '#444' },

  { tag: t.meta, color: '#bbb' },
  { tag: t.processingInstruction, color: '#bbb' },
  { tag: t.contentSeparator, color: '#ccc' },
])

// ── 高亮（暗）─────────────────────────────────────────
const markdownHighlightDark = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.8em', fontWeight: '700', color: '#f0f0f0' },
  { tag: t.heading2, fontSize: '1.5em', fontWeight: '700', color: '#f0f0f0' },
  { tag: t.heading3, fontSize: '1.25em', fontWeight: '700', color: '#f0f0f0' },
  { tag: t.heading4, fontSize: '1.1em', fontWeight: '700', color: '#e0e0e0' },
  { tag: t.heading5, fontSize: '1em', fontWeight: '700', color: '#d0d0d0' },
  { tag: t.heading6, fontSize: '1em', fontWeight: '700', color: '#b0b0b0' },

  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#777' },

  { tag: t.link, color: '#4a9eda' },
  { tag: t.url, color: '#4a9eda', textDecoration: 'underline' },

  {
    tag: t.monospace,
    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", monospace',
    background: '#2a2a2a',
    color: '#ff7b9d',
    padding: '0 4px',
    borderRadius: '3px',
  },

  { tag: t.quote, color: '#888', fontStyle: 'italic' },
  { tag: t.list, color: '#c0c0c0' },

  { tag: t.meta, color: '#666' },
  { tag: t.processingInstruction, color: '#666' },
  { tag: t.contentSeparator, color: '#555' },
])

// ── 通用主题构造器：传入色板生成 EditorView.theme ──────
interface Palette {
  background: string
  foreground: string
  gutterBg: string
  gutterFg: string
  borderColor: string
  activeLineBg: string
  activeLineGutterBg: string
  selectionBgFocused: string
  selectionBgBlurred: string
  selectionMatchBg: string
  caretColor: string
  dark: boolean
}

function makeTheme(p: Palette) {
  return EditorView.theme(
    {
      '&': {
        fontSize: '15px',
        height: '100%',
        color: p.foreground,
        backgroundColor: p.background,
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-scroller': {
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Helvetica, Arial, sans-serif',
        lineHeight: '1.75',
      },
      '.cm-content': {
        padding: '1.25rem 2rem 4rem',
        caretColor: p.caretColor,
      },
      '.cm-line': {
        padding: '2px 0',
      },
      '.cm-gutters': {
        backgroundColor: p.gutterBg,
        color: p.gutterFg,
        border: 'none',
        borderRight: `1px solid ${p.borderColor}`,
      },
      '.cm-activeLine': {
        backgroundColor: p.activeLineBg,
      },
      '.cm-activeLineGutter': {
        backgroundColor: p.activeLineGutterBg,
      },
      '.cm-selectionMatch': {
        backgroundColor: p.selectionMatchBg,
      },
      // 把 selectionLayer 提到 content 之上；半透明色块覆盖文字
      '.cm-selectionLayer': {
        zIndex: '1 !important',
      },
      '.cm-selectionLayer .cm-selectionBackground, ::selection': {
        background: `${p.selectionBgBlurred} !important`,
      },
      '&.cm-focused .cm-selectionLayer .cm-selectionBackground, &.cm-focused ::selection': {
        background: `${p.selectionBgFocused} !important`,
      },
      // y-codemirror.next 远程光标
      '.cm-ySelectionCaret': {
        position: 'relative',
        borderLeft: '2px solid',
        marginLeft: '-1px',
        marginRight: '-1px',
        pointerEvents: 'none',
      },
      '.cm-ySelectionInfo': {
        position: 'absolute',
        top: '-1.4em',
        left: '-2px',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#fff',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      },
    },
    { dark: p.dark },
  )
}

// ── 亮 / 暗两套色板 ───────────────────────────────────
const lightPalette: Palette = {
  background: '#ffffff',
  foreground: '#222222',
  gutterBg: '#fafafa',
  gutterFg: '#bbbbbb',
  borderColor: '#eeeeee',
  activeLineBg: 'rgba(31, 119, 180, 0.05)',
  activeLineGutterBg: '#f0f4fa',
  selectionBgFocused: 'rgba(90, 157, 240, 0.45)',
  selectionBgBlurred: 'rgba(120, 120, 120, 0.35)',
  selectionMatchBg: '#fff3a0',
  caretColor: '#222222',
  dark: false,
}

const darkPalette: Palette = {
  background: '#1a1a1a',
  foreground: '#e6e6e6',
  gutterBg: '#1f1f1f',
  gutterFg: '#5a5a5a',
  borderColor: '#2a2a2a',
  activeLineBg: 'rgba(120, 180, 255, 0.06)',
  activeLineGutterBg: '#252a33',
  selectionBgFocused: 'rgba(90, 157, 240, 0.45)',
  selectionBgBlurred: 'rgba(200, 200, 200, 0.18)',
  selectionMatchBg: 'rgba(255, 230, 100, 0.25)',
  caretColor: '#e6e6e6',
  dark: true,
}

export const typoraExtensionsLight = [
  makeTheme(lightPalette),
  syntaxHighlighting(markdownHighlightLight),
]

export const typoraExtensionsDark = [
  makeTheme(darkPalette),
  syntaxHighlighting(markdownHighlightDark),
]

// 兼容旧名（避免现存 import 报错）
export const typoraExtensions = typoraExtensionsLight
