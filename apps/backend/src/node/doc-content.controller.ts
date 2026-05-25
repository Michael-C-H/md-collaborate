/**
 * 文档内容接口
 * by AI.Coding
 *
 * GET /api/docs/:id/content   读取当前内容（仅 READ）
 *
 * 文档内容的"写"通道由 Hocuspocus onStoreDocument 钩子完成，
 * 这里只暴露 GET 端点供前端做"离线预览 / 导出菜单初始化"等只读场景使用。
 */
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'
import { ok } from '../common/api-result'
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator'
import { NodeService } from './node.service'

@Controller('docs')
export class DocContentController {
  constructor(private readonly service: NodeService) {}

  @Get(':id/content')
  async loadContent(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const content = await this.service.loadDocContent(user.userId, user.role === 'ADMIN', id)
    return ok(content)
  }
}
