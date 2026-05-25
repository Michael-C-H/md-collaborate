/**
 * 管理员用户管理 Controller
 * by AI.Coding
 *
 * POST   /api/admin/users        创建用户
 * GET    /api/admin/users        用户列表（分页）
 * PATCH  /api/admin/users/:id    修改用户
 * DELETE /api/admin/users/:id    删除用户
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import {
  AdminUserListQuerySchema,
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  type CreateUserRequest,
  type UpdateUserRequest,
  type AdminUserListQuery,
} from '@app/shared'
import { ok } from '../common/api-result'
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator'
import { AdminGuard } from '../common/guards/admin.guard'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { BadRequestException } from '../common/exceptions/app.exception'
import { AuthService } from '../auth/auth.service'
import { KnownUserService } from '../user/user.service'

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUserController {
  constructor(
    private readonly userService: KnownUserService,
    private readonly authService: AuthService,
  ) {}

  /** 创建本地用户 */
  @Post()
  @UsePipes(new ZodValidationPipe(CreateUserRequestSchema))
  async create(@Body() body: CreateUserRequest) {
    const passwordHash = await this.authService.hashPassword(body.password)
    const user = await this.userService.createLocal({
      username: body.username,
      passwordHash,
      displayName: body.displayName,
      role: body.role,
    })
    return ok(user)
  }

  /** 用户列表（分页） */
  @Get()
  @UsePipes(new ZodValidationPipe(AdminUserListQuerySchema))
  async list(@Query() query: AdminUserListQuery) {
    const result = await this.userService.listUsers(query.page, query.pageSize, query.keyword)
    return ok(result)
  }

  /** 修改用户 */
  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateUserRequestSchema))
  async update(
    @Param('id') idStr: string,
    @Body() body: UpdateUserRequest,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    const id = Number(idStr)
    if (id === currentUser.userId) {
      throw new BadRequestException('不能修改自己的账号')
    }
    const updateInput: { displayName?: string; role?: string; passwordHash?: string } = {}
    if (body.displayName !== undefined) updateInput.displayName = body.displayName
    if (body.role !== undefined) updateInput.role = body.role
    if (body.password !== undefined) {
      // SSO 用户不允许修改密码
      const target = await this.userService.findRowById(id)
      if (target && target.loginType !== 'LOCAL') {
        throw new BadRequestException('SSO 用户不支持修改密码')
      }
      updateInput.passwordHash = await this.authService.hashPassword(body.password)
    }
    const user = await this.userService.updateUser(id, updateInput)
    return ok(user)
  }

  /** 删除用户 */
  @Delete(':id')
  async remove(
    @Param('id') idStr: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    const id = Number(idStr)
    if (id === currentUser.userId) {
      throw new BadRequestException('不能删除自己')
    }
    await this.userService.deleteUser(id)
    return ok(null)
  }
}
