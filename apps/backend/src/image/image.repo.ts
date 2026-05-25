/**
 * images / image_refs 表 Drizzle 仓储
 * by AI.Coding
 */
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { DrizzleClient } from '../database/drizzle.client'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import {
  imageRefs,
  images,
  type ImageInsert,
  type ImageRow,
} from '../database/schema'

@Injectable()
export class ImageRepo {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient) {}

  /** 插入图片并返回新 id */
  async insertAndReturnId(input: ImageInsert): Promise<number> {
    const result = await this.db.insert(images).values(input)
    const header = (result as unknown as Array<{ insertId?: number | string }>)[0]
    const insertId = header?.insertId
    if (insertId === undefined || insertId === null) {
      throw new Error('插入图片失败：未获取到 insertId')
    }
    return Number(insertId)
  }

  /** 按 urlToken 精确查询 */
  async findByUrlToken(token: string): Promise<ImageRow | null> {
    const rows = await this.db
      .select()
      .from(images)
      .where(eq(images.urlToken, token))
      .limit(1)
    return rows[0] ?? null
  }

  /** 添加图片在文档中的引用（幂等） */
  async addRef(imageId: number, docId: number): Promise<void> {
    const now = new Date()
    await this.db
      .insert(imageRefs)
      .values({ imageId, docId, createdAt: now })
      .onDuplicateKeyUpdate({ set: { createdAt: now } })
  }
}
