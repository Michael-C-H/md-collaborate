/**
 * 导入接口
 * by AI.Coding
 *
 * POST /api/imports/md   单文件 .md / .markdown 导入
 * POST /api/imports/zip  zip 批量导入（按目录还原）
 *
 * 两者都通过 multipart 提交：
 *   form-data:
 *     file:      文件
 *     parentId:  可选，目标父文件夹 id（不传则导入到根）
 */
import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ConfigService } from '@nestjs/config'
import { ok } from '../common/api-result'
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator'
import { BadRequestException } from '../common/exceptions/app.exception'
import { bufferToUtf8, fixMulterFilename } from '../common/utils/encoding'
import type { AppConfig } from '../config/app-config.schema'
import { MarkdownImporter } from './markdown.service'
import { ZipImporter } from './zip.service'

@Controller('imports')
export class ImportController {
  private readonly maxMdBytes: number
  private readonly maxZipBytes: number

  constructor(
    private readonly markdownImporter: MarkdownImporter,
    private readonly zipImporter: ZipImporter,
    config: ConfigService<AppConfig, true>,
  ) {
    this.maxMdBytes = config.get('MAX_IMPORT_MD_SIZE_MB', { infer: true }) * 1024 * 1024
    this.maxZipBytes = config.get('MAX_IMPORT_ZIP_SIZE_MB', { infer: true }) * 1024 * 1024
  }

  /** 单文件 .md 导入 */
  @Post('md')
  @UseInterceptors(FileInterceptor('file'))
  async importMd(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('parentId') parentIdRaw: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) throw new BadRequestException('缺少 file')
    if (file.buffer.length > this.maxMdBytes) {
      throw new BadRequestException(
        `单文件不能超过 ${Math.round(this.maxMdBytes / 1024 / 1024)} MB`,
      )
    }
    const parentId = toValidParentId(parentIdRaw)
    // 文件编码自动识别（UTF-8 / UTF-16 BOM / GBK 兜底）
    const content = bufferToUtf8(file.buffer)
    // 修复 multer 中文文件名（latin1 → utf-8）
    const fixedName = fixMulterFilename(file.originalname)
    const result = await this.markdownImporter.importFile(
      user.userId,
      user.role === 'ADMIN',
      parentId,
      fixedName,
      content,
    )
    return ok({ items: [result] })
  }

  /** zip 批量导入 */
  @Post('zip')
  @UseInterceptors(FileInterceptor('file'))
  async importZip(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('parentId') parentIdRaw: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) throw new BadRequestException('缺少 file')
    if (file.buffer.length > this.maxZipBytes) {
      throw new BadRequestException(
        `zip 不能超过 ${Math.round(this.maxZipBytes / 1024 / 1024)} MB`,
      )
    }
    const parentId = toValidParentId(parentIdRaw)
    const items = await this.zipImporter.importZip(
      user.userId,
      user.role === 'ADMIN',
      parentId,
      file.buffer,
    )
    return ok({ items })
  }
}

function toValidParentId(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}
