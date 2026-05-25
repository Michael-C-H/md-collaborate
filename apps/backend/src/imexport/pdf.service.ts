/**
 * PDF 渲染服务
 * by AI.Coding
 *
 * markdown → HTML（markdown-it）→ Playwright Chromium → PDF
 *
 * 注意：
 *   - 首次启动需要 chromium，确保已运行 `npx playwright install chromium`
 *   - 单 Browser 实例复用；应用关闭时 onApplicationShutdown 销毁
 *   - 单进程 100 并发场景下不做 worker pool，遇到性能瓶颈再升级
 */
import { Injectable, type OnApplicationShutdown } from '@nestjs/common'
import { Logger } from 'nestjs-pino'
import MarkdownIt from 'markdown-it'
import { chromium, type Browser } from 'playwright'
import { ImageService } from '../image/image.service'
import { inlineImageUrlsAsBase64 } from './image-inliner'

@Injectable()
export class PdfRenderer implements OnApplicationShutdown {
  private browser: Browser | null = null
  private readonly md: MarkdownIt

  constructor(
    private readonly logger: Logger,
    private readonly imageService: ImageService,
  ) {
    this.md = new MarkdownIt({ html: false, linkify: true, breaks: false })
  }

  /** 渲染 markdown 为 PDF Buffer */
  async render(markdown: string, title = 'document'): Promise<Buffer> {
    // 把 /api/images/<token> 内联为 data URI，避免 Playwright 回连后端
    const inlined = await inlineImageUrlsAsBase64(markdown, this.imageService)
    const browser = await this.ensureBrowser()
    const page = await browser.newPage()
    try {
      const html = this.composeHtml(inlined, title)
      await page.setContent(html, { waitUntil: 'networkidle' })
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
        printBackground: true,
      })
      return pdf
    } finally {
      await page.close()
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close()
      } catch (err) {
        this.logger.warn({ err }, 'Browser close 失败')
      }
      this.browser = null
    }
  }

  // ── 内部 ───────────────────────────────────────────────

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({ headless: true })
    }
    return this.browser
  }

  /** 用通用 GitHub 风格 CSS 把 HTML 包成完整 HTML5 文档 */
  private composeHtml(markdown: string, title: string): string {
    const body = this.md.render(markdown)
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei",
                   Helvetica, Arial, sans-serif;
      color: #222;
      line-height: 1.75;
      font-size: 14px;
      padding: 0;
      margin: 0;
    }
    h1, h2, h3, h4, h5, h6 { margin: 1.2em 0 0.6em; font-weight: 700; line-height: 1.3; }
    h1 { font-size: 1.8em; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1.1em; }
    p { margin: 0.75em 0; }
    a { color: #1f77b4; }
    blockquote {
      margin: 0.75em 0;
      padding: 0 1rem;
      border-left: 4px solid #ddd;
      color: #666;
    }
    ul, ol { padding-left: 1.5rem; margin: 0.5em 0; }
    li { margin: 0.2em 0; }
    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
      background: #f5f5f5;
      padding: 0.1em 0.4em;
      border-radius: 3px;
      font-size: 0.92em;
    }
    pre {
      background: #f6f8fa;
      border-radius: 4px;
      padding: 0.75em 1em;
      overflow: auto;
    }
    pre code { background: transparent; padding: 0; }
    table { border-collapse: collapse; margin: 0.75em 0; }
    th, td { border: 1px solid #ddd; padding: 0.4em 0.8em; }
    th { background: #f6f8fa; font-weight: 600; }
    hr { border: none; border-top: 2px solid #eee; margin: 1.5em 0; }
    img { max-width: 100%; }
  </style>
</head>
<body>${body}</body>
</html>`
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[c] ?? c
  })
}
