/**
 * Auth 业务服务
 * by AI.Coding
 *
 * 当前职责仅提供登出跳转地址；session 的解析与销毁由 controller / middleware 直接操作。
 */
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AppConfig } from '../config/app-config.schema'

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  /** 登出后浏览器需要跳转的三方系统首页地址（来自配置） */
  getLogoutRedirectUrl(): string {
    return this.config.get('SSO_LOGOUT_REDIRECT', { infer: true })
  }
}
