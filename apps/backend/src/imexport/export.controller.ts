/**
 * 导出接口
 * by AI.Coding
 *
 * GET /api/docs/:docId/export-md   返回 markdown 文件下载
 * GET /api/docs/:docId/export-pdf  返回 PDF 下载（Playwright 渲染）
 */
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator'
import { PermissionGuard } from '../permission/permission.guard'
import { RequirePermission } from '../permission/require-permission.decorator'
import { absolutizeImageUrls } from './image-inliner'
import { MarkdownImporter } from './markdown.service'
import { PdfRenderer } from './pdf.service'

@Controller('docs')
@UseGuards(PermissionGuard)
export class ExportController {
  constructor(
    private readonly markdownImporter: MarkdownImporter,
    private readonly pdfRenderer: PdfRenderer,
  ) {}

  /** 导出 markdown：把图片相对路径改成绝对 URL，便于离线/跨设备查看 */
  @Get(':docId/export-md')
  @RequirePermission('READ', 'docId')
  async exportMd(
    @Param('docId', ParseIntPipe) docId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const raw = await this.markdownImporter.getDocContent(docId)
    const content = absolutizeImageUrls(raw, deriveOrigin(req))
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="doc-${docId}.md"`)
    res.end(content)
  }

  /** 导出 PDF（Playwright 渲染） */
  @Get(':docId/export-pdf')
  @RequirePermission('READ', 'docId')
  async exportPdf(
    @Param('docId', ParseIntPipe) docId: number,
    @CurrentUser() _user: CurrentUserPayload,
    @Res() res: Response,
  ): Promise<void> {
    const content = await this.markdownImporter.getDocContent(docId)
    const pdf = await this.pdfRenderer.render(content, `doc-${docId}`)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="doc-${docId}.pdf"`)
    res.end(pdf)
  }
}

/** 反向代理友好：优先用 X-Forwarded-* 头 */
function deriveOrigin(req: Request): string {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ||
    req.protocol
  const host =
    (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ||
    req.headers.host ||
    ''
  if (!host) return ''
  return `${proto}://${host}`
}
