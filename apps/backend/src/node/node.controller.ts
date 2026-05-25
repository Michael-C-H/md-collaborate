/**
 * Node controller — 文档树 CRUD
 * by AI.Coding
 *
 * GET    /api/nodes/tree     当前用户可见的节点树
 * GET    /api/nodes/:id      节点详情（需 READ）
 * POST   /api/nodes          创建节点
 * PATCH  /api/nodes/:id      重命名 / 移动（需 WRITE）
 * DELETE /api/nodes/:id      软删整棵子树（需 MANAGE）
 *
 * 文档内容相关接口位于 doc-content.controller.ts。
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common'
import {
  CreateNodeSchema,
  UpdateNodeSchema,
  type CreateNodeDto,
  type UpdateNodeDto,
} from '@app/shared'
import { ok } from '../common/api-result'
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { NodeService } from './node.service'

@Controller('nodes')
export class NodeController {
  constructor(private readonly service: NodeService) {}

  /** 当前用户可见的节点树 */
  @Get('tree')
  async tree(@CurrentUser() user: CurrentUserPayload) {
    const tree = await this.service.loadTree(user.userId, user.role === 'ADMIN')
    return ok(tree)
  }

  /** 三棵树：我的文档 + 共享给我 + 他人文档（管理员专属） */
  @Get('trees')
  async trees(@CurrentUser() user: CurrentUserPayload) {
    const result = await this.service.loadTrees(user.userId, user.role === 'ADMIN')
    return ok(result)
  }

  /** 节点详情 */
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const node = await this.service.findVO(user.userId, user.role === 'ADMIN', id)
    return ok(node)
  }

  /** 创建节点 */
  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateNodeSchema)) dto: CreateNodeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const node = await this.service.create(user.userId, user.role === 'ADMIN', dto)
    return ok(node)
  }

  /** 重命名 / 移动 */
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateNodeSchema)) dto: UpdateNodeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const node = await this.service.update(user.userId, user.role === 'ADMIN', id, dto)
    return ok(node)
  }

  /** 软删 */
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.service.softDelete(user.userId, user.role === 'ADMIN', id)
    return ok(null)
  }
}
