/**
 * PermissionGuard — 文档级权限校验
 * by AI.Coding
 *
 * 流程：
 *   1) 读取 handler 上的 @RequirePermission 元数据；没标 → 放行
 *   2) 当前用户为 ADMIN → 放行
 *   3) 从 request.params 取节点 id（key 由元数据指定，默认 'id'）
 *   4) 用 drizzle 直接查 nodes.creator_id（不依赖 NodeModule，避免循环依赖）
 *   5) PermissionService.hasMinRole 判定
 */
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { and, eq, isNull } from 'drizzle-orm'
import type { Request } from 'express'
import { ForbiddenException, NotFoundException } from '../common/exceptions/app.exception'
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import type { DrizzleClient } from '../database/drizzle.client'
import { nodes } from '../database/schema'
import {
  REQUIRE_PERMISSION_KEY,
  type RequirePermissionMeta,
} from './require-permission.decorator'
import { PermissionService } from './permission.service'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<RequirePermissionMeta | undefined>(
      REQUIRE_PERMISSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    )
    if (!meta) return true

    const req = ctx
      .switchToHttp()
      .getRequest<Request & { session?: { user?: CurrentUserPayload } }>()
    const user = req.session?.user
    if (!user) throw new ForbiddenException('未登录')

    // ADMIN 直接放行（减少一次 DB 查询）
    if (user.role === 'ADMIN') return true

    const raw = (req.params as Record<string, string | undefined>)[meta.paramKey]
    const nodeId = Number(raw)
    if (!Number.isFinite(nodeId) || nodeId <= 0) {
      throw new ForbiddenException('节点 id 不合法')
    }

    // 直接查 nodes.creator_id；不依赖 NodeRepo，避免循环依赖
    const rows = await this.db
      .select({ id: nodes.id, creatorId: nodes.creatorId })
      .from(nodes)
      .where(and(eq(nodes.id, nodeId), isNull(nodes.deletedAt)))
      .limit(1)
    const node = rows[0]
    if (!node) throw new NotFoundException('节点不存在')

    const ok = await this.permissionService.hasMinRole(
      user.userId,
      false,
      nodeId,
      meta.minRole,
      node.creatorId,
    )
    if (!ok) throw new ForbiddenException('没有权限执行该操作')
    return true
  }
}
