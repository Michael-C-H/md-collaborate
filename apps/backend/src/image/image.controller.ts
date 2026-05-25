/**
 * 图片 controller
 * by AI.Coding
 *
 * POST /api/images          上传图片（multipart "file" + 可选 "docId" query）
 * GET  /api/images/:token   读取图片（局域网内不强制鉴权，配 url_token 不可猜测）
 */
import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { ok } from '../common/api-result'
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator'
import {
  BadRequestException,
  NotFoundException,
} from '../common/exceptions/app.exception'
import { SkipAuth } from '../auth/session.guard'
import { ImageService } from './image.service'

@Controller('images')
export class ImageController {
  constructor(private readonly service: ImageService) {}

  /** 上传图片；docId 可选（不传不写引用计数） */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('docId') docIdRaw: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) throw new BadRequestException('缺少 file 字段')
    const docId = docIdRaw ? Number(docIdRaw) : null
    const validDocId = docId !== null && Number.isFinite(docId) && docId > 0 ? docId : null
    const result = await this.service.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      user.userId,
      validDocId,
    )
    return ok(result)
  }

  /**
   * 读取图片。
   * url_token 不可猜测；局域网内允许匿名访问，便于 <img src> 直接显示
   * （浏览器请求 <img> 默认会带 cookie，但有些场景如 markdown 渲染嵌入到独立预览
   *  也希望能加载，所以这里跳过 SessionGuard）。
   */
  @Get(':token')
  @SkipAuth()
  async serve(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const result = await this.service.serve(token)
    if (!result) {
      throw new NotFoundException('图片不存在')
    }
    res.setHeader('Content-Type', result.mimeType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.end(result.buffer)
  }
}
