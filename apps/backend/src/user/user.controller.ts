/**
 * 用户检索 controller
 * by AI.Coding
 *
 * GET /api/users/search?q=&limit=20         模糊检索
 * GET /api/users/by-username/:username      精确查询（用于分享面板"未登录用户"判定）
 */
import { Controller, Get, Param, Query, UsePipes } from '@nestjs/common'
import { SearchUserQuerySchema, type SearchUserQuery } from '@app/shared'
import { ok } from '../common/api-result'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { KnownUserService } from './user.service'

@Controller('users')
export class UserController {
  constructor(private readonly service: KnownUserService) {}

  /** 模糊检索 */
  @Get('search')
  @UsePipes(new ZodValidationPipe(SearchUserQuerySchema))
  async search(@Query() query: SearchUserQuery) {
    const list = await this.service.searchByKeyword(query.q, query.limit)
    return ok(list)
  }

  /** 精确查询（路径参数；username 由路由本身校验存在） */
  @Get('by-username/:username')
  async byUsername(@Param('username') username: string) {
    const user = await this.service.findByUsername(username)
    return ok(user)
  }
}
