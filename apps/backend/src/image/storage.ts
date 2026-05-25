/**
 * 图片本地文件存储
 * by AI.Coding
 *
 * 存储路径：${UPLOAD_DIR}/yyyy/MM/dd/{uuid}.{ext}
 * 用相对路径写入 images.storage_path 字段，读取时拼回绝对路径。
 */
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { v4 as uuid } from 'uuid'
import type { AppConfig } from '../config/app-config.schema'

@Injectable()
export class ImageStorage {
  private readonly uploadDir: string

  constructor(config: ConfigService<AppConfig, true>) {
    this.uploadDir = config.get('UPLOAD_DIR', { infer: true })
  }

  /** 保存图片；返回相对路径（不含 uploadDir 前缀） */
  async save(buffer: Buffer, ext: string): Promise<{ storagePath: string }> {
    const now = new Date()
    const yyyy = String(now.getFullYear())
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const fileName = `${uuid()}${ext}`
    const relPath = path.posix.join(yyyy, mm, dd, fileName)
    const absPath = path.join(this.uploadDir, yyyy, mm, dd, fileName)

    await fs.mkdir(path.dirname(absPath), { recursive: true })
    await fs.writeFile(absPath, buffer)
    return { storagePath: relPath }
  }

  /** 读取图片二进制 */
  async read(storagePath: string): Promise<Buffer> {
    const absPath = path.join(this.uploadDir, storagePath)
    return fs.readFile(absPath)
  }

  /** 物理删除；不存在时静默忽略 */
  async delete(storagePath: string): Promise<void> {
    const absPath = path.join(this.uploadDir, storagePath)
    try {
      await fs.unlink(absPath)
    } catch {
      // 文件已不存在，OK
    }
  }
}
