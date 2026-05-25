/**
 * @RequirePermission 装饰器
 * by AI.Coding
 *
 * 用法：
 *   @Get(':id')
 *   @RequirePermission('READ')
 *   findOne(@Param('id') id: number) { ... }
 *
 * 元数据被 PermissionGuard 读取：从 request.params 取节点 id 并校验当前用户的最低角色。
 */
import { SetMetadata } from '@nestjs/common'
import type { PermissionRole } from '@app/shared'

export const REQUIRE_PERMISSION_KEY = 'require-permission'

export interface RequirePermissionMeta {
  /** 最低需要的角色 */
  minRole: PermissionRole
  /** 从 request.params 中取节点 id 用的键名，默认 'id' */
  paramKey: string
}

export const RequirePermission = (
  minRole: PermissionRole,
  paramKey: string = 'id',
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { minRole, paramKey } satisfies RequirePermissionMeta)
