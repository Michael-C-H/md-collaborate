/**
 * Image 模块
 * by AI.Coding
 */
import { Module } from '@nestjs/common'
import { ImageController } from './image.controller'
import { ImageRepo } from './image.repo'
import { ImageService } from './image.service'
import { ImageStorage } from './storage'

@Module({
  controllers: [ImageController],
  providers: [ImageService, ImageRepo, ImageStorage],
  exports: [ImageService, ImageStorage, ImageRepo],
})
export class ImageModule {}
