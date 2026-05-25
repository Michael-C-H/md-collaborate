/**
 * Auth 业务服务
 * by AI.Coding
 *
 * 提供本地登录、密码哈希、初始管理员种子等功能。
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import type { CurrentUser } from '@app/shared'
import type { AppConfig } from '../config/app-config.schema'
import { KnownUserService } from '../user/user.service'

const BCRYPT_ROUNDS = 10

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly knownUserService: KnownUserService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedAdminUser()
  }

  /** 登出后浏览器需要跳转的三方系统首页地址（来自配置）；LOCAL 用户返回 null */
  getLogoutRedirectUrl(): string {
    return this.config.get('SSO_LOGOUT_REDIRECT', { infer: true })
  }

  /** 本地登录：验证用户名密码，成功返回 CurrentUser payload，失败返回 null */
  async login(username: string, password: string): Promise<CurrentUser | null> {
    const row = await this.knownUserService.findLocalByUsername(username)
    if (!row || !row.passwordHash) return null

    const valid = await bcrypt.compare(password, row.passwordHash)
    if (!valid) return null

    return {
      userId: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role === 'ADMIN' ? 'ADMIN' : 'USER',
      loginType: 'LOCAL',
    }
  }

  /** 对明文密码做 bcrypt 哈希 */
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS)
  }

  /** 用户自助修改密码；返回 true 成功，false 旧密码错误，null 用户不存在或非 LOCAL */
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<boolean | null> {
    const row = await this.knownUserService.findRowById(userId)
    if (!row || row.loginType !== 'LOCAL' || !row.passwordHash) return null
    const valid = await bcrypt.compare(oldPassword, row.passwordHash)
    if (!valid) return false
    const newHash = await this.hashPassword(newPassword)
    await this.knownUserService.updateUser(userId, { passwordHash: newHash })
    return true
  }

  /** 启动时根据环境变量创建/同步初始管理员 */
  private async seedAdminUser(): Promise<void> {
    const username = this.config.get('ADMIN_USERNAME', { infer: true })
    const password = this.config.get('ADMIN_PASSWORD', { infer: true })
    if (!username || !password) return

    const existing = await this.knownUserService.findRowByUsername(username)
    if (existing) {
      // 已存在：仅确保角色是 ADMIN，不覆盖密码（管理员可能已自行修改）
      if (existing.role !== 'ADMIN') {
        await this.knownUserService.updateUser(existing.id, { role: 'ADMIN' })
      }
      this.logger.log(`初始管理员 [${username}] 已存在，跳过`)
      return
    }

    // 不存在：创建
    const passwordHash = await this.hashPassword(password)
    await this.knownUserService.createLocal({
      username,
      passwordHash,
      displayName: username,
      role: 'ADMIN',
    })
    this.logger.log(`初始管理员 [${username}] 已创建`)
  }
}
