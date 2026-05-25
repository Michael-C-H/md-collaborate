/**
 * 导出时图片地址重写
 * by AI.Coding
 *
 * 编辑器写入文档的图片地址是相对路径 `/api/images/<token>`，
 * 直接导出后在 Typora / 第三方 Markdown 渲染器 / Playwright 里都解析不出域名。
 *
 *   - absolutizeImageUrls：把相对地址改成绝对 URL（用导出请求的 origin）
 *     适合 .md 文件下载，文件小；前提是查看者能访问本系统（局域网部署符合）
 *   - inlineImageUrlsAsBase64：把图片二进制读出来内联成 data URI
 *     适合 PDF 渲染，Playwright 不需要回连后端就能拿到图
 */
import type { ImageService } from '../image/image.service'

/** 匹配 `/api/images/<32 位 hex>`；token 来自 uuid().replace('-', '') */
const IMAGE_URL_PATTERN = /\/api\/images\/([a-f0-9]{32})/g

export function absolutizeImageUrls(markdown: string, origin: string): string {
  const cleanedOrigin = origin.replace(/\/+$/, '')
  if (!cleanedOrigin) return markdown
  return markdown.replace(IMAGE_URL_PATTERN, (full) => `${cleanedOrigin}${full}`)
}

export async function inlineImageUrlsAsBase64(
  markdown: string,
  imageService: ImageService,
): Promise<string> {
  // 去重，避免同一张图被引用多次时重复加载
  const tokens = new Set<string>()
  const scanRe = new RegExp(IMAGE_URL_PATTERN.source, 'g')
  let m: RegExpExecArray | null
  while ((m = scanRe.exec(markdown)) !== null) {
    const t = m[1]
    if (t) tokens.add(t)
  }
  if (tokens.size === 0) return markdown

  const cache = new Map<string, string>()
  for (const token of tokens) {
    try {
      const r = await imageService.serve(token)
      if (r) {
        cache.set(token, `data:${r.mimeType};base64,${r.buffer.toString('base64')}`)
      }
    } catch {
      // 单张失败保留原地址，不阻塞导出
    }
  }

  return markdown.replace(IMAGE_URL_PATTERN, (full, token: string) => {
    const dataUri = cache.get(token)
    return dataUri ?? full
  })
}
