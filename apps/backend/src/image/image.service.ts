/**
 * 图片业务服务
 * by AI.Coding
 */
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import path from 'node:path'
import { v4 as uuid } from 'uuid'
import type { ImageUploadResult } from '@app/shared'
import { BadRequestException } from '../common/exceptions/app.exception'
import type { AppConfig } from '../config/app-config.schema'
import { ImageRepo } from './image.repo'
import { ImageStorage } from './storage'

/** 允许的图片 MIME 前缀 */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])

/** 允许的文件后缀（统一小写） */
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'])

@Injectable()
export class ImageService {
  private readonly maxBytes: number

  constructor(
    private readonly storage: ImageStorage,
    private readonly repo: ImageRepo,
    config: ConfigService<AppConfig, true>,
  ) {
    this.maxBytes = config.get('MAX_IMAGE_SIZE_MB', { infer: true }) * 1024 * 1024
  }

  /**
   * 上传图片：
   *   1) 校验 MIME / 后缀 / 大小
   *   2) 写本地文件系统（带日期分桶）
   *   3) 写 images 表（生成 url_token）
   *   4) 若指定 docId 则写 image_refs 引用计数
   */
  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    uploaderId: number,
    docId: number | null,
  ): Promise<ImageUploadResult> {
    if (!ALLOWED_MIME.has(mimeType.toLowerCase())) {
      throw new BadRequestException('图片格式不支持，仅允许 JPG/PNG/GIF/WebP/SVG')
    }
    const ext = path.extname(originalName).toLowerCase()
    if (!ALLOWED_EXTS.has(ext)) {
      throw new BadRequestException('图片文件后缀不合法')
    }
    if (buffer.length > this.maxBytes) {
      const limitMb = Math.round(this.maxBytes / 1024 / 1024)
      throw new BadRequestException(`图片不能超过 ${limitMb} MB`)
    }

    // 写本地文件
    const { storagePath } = await this.storage.save(buffer, ext)
    // 不可猜测 token；去掉短横线让 URL 更紧凑
    const urlToken = uuid().replace(/-/g, '')
    const now = new Date()
    const id = await this.repo.insertAndReturnId({
      urlToken,
      storagePath,
      sizeBytes: buffer.length,
      mimeType,
      uploaderId,
      createdAt: now,
    })

    if (docId !== null && Number.isFinite(docId) && docId > 0) {
      await this.repo.addRef(id, docId)
    }

    return {
      url: `/api/images/${urlToken}`,
      urlToken,
      sizeBytes: buffer.length,
      mimeType,
    }
  }

  /** 按 token 取图片二进制 + mime；不存在返回 null */
  async serve(urlToken: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const row = await this.repo.findByUrlToken(urlToken)
    if (!row) return null
    const buffer = await this.storage.read(row.storagePath)
    return { buffer, mimeType: row.mimeType }
  }
}
