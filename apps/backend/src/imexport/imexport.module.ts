/**
 * 导入导出模块
 * by AI.Coding
 */
import { Module } from '@nestjs/common'
import { ImageModule } from '../image/image.module'
import { NodeModule } from '../node/node.module'
import { PermissionModule } from '../permission/permission.module'
import { ExportController } from './export.controller'
import { ImportController } from './import.controller'
import { MarkdownImporter } from './markdown.service'
import { PdfRenderer } from './pdf.service'
import { ZipImporter } from './zip.service'

@Module({
  imports: [NodeModule, PermissionModule, ImageModule],
  controllers: [ImportController, ExportController],
  providers: [MarkdownImporter, ZipImporter, PdfRenderer],
  exports: [MarkdownImporter],
})
export class ImExportModule {}
