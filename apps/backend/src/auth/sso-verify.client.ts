/**
 * SSO verify 客户端
 * by AI.Coding
 *
 * 调用三方 /api/sso/verify 验证 ssoToken。
 * 成功 → 返回 SsoUser；失败 → 抛 SsoVerifyException（含 error_code）。
 *
 * 失败分类：
 *   - 三方返回 4xx + error_code → 透传 error_code（如 TOKEN_CONSUMED / TOKEN_EXPIRED）
 *   - 网络错误 / 超时 / 5xx → SSO_UNAVAILABLE，并在日志里记录详细原因便于排查
 */
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { type AxiosError } from 'axios'
import { Logger } from 'nestjs-pino'
import { SsoVerifyException } from '../common/exceptions/sso-verify.exception'
import type { AppConfig } from '../config/app-config.schema'

/** SSO verify 成功响应结构 */
export interface SsoUser {
  userId: number
  username: string
  displayName: string
  /** 原始 role 字符串；本系统只关心是否为 'ADMIN' */
  role: string
  /** 业务无关字段，本系统不使用 */
  resourceType?: string
  /** 业务无关字段，本系统不使用 */
  employeeType?: string
}

/** SSO verify 失败响应结构 */
interface VerifyErrorBody {
  status?: number
  error_code?: string
  message?: string
}

@Injectable()
export class SsoVerifyClient {
  private readonly baseUrl: string
  private readonly clientId: string
  private readonly clientSecret: string

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly logger: Logger,
  ) {
    this.baseUrl = config.get('SSO_BASE_URL', { infer: true })
    this.clientId = config.get('SSO_CLIENT_ID', { infer: true })
    this.clientSecret = config.get('SSO_CLIENT_SECRET', { infer: true })
  }

  /** SSO 是否已配置（baseUrl 非空） */
  isConfigured(): boolean {
    return !!this.baseUrl
  }

  /**
   * 校验 ssoToken；硬超时 5 秒。
   * 成功 → 返回 SsoUser；失败 → 抛 SsoVerifyException。
   */
  async verify(ssoToken: string): Promise<SsoUser> {
    const url = `${this.baseUrl}/api/sso/verify`
    try {
      const resp = await axios.post<SsoUser>(
        url,
        {
          clientId: this.clientId,
          clientSecret: this.clientSecret,
          ssoToken,
        },
        { timeout: 5_000 },
      )
      const data = resp.data
      // 成功响应必须含 userId / username / displayName 三要素
      if (!data || typeof data.userId !== 'number' || !data.username) {
        this.logger.error(
          { url, responseBody: data },
          'SSO 返回格式不合法（缺 userId/username）',
        )
        throw new SsoVerifyException('INVALID_RESPONSE', 'SSO 返回格式不合法')
      }
      return data
    } catch (err) {
      if (err instanceof SsoVerifyException) {
        throw err
      }
      const axiosErr = err as AxiosError<VerifyErrorBody>
      const body = axiosErr.response?.data
      // 三方明确返回了 error_code → 透传
      if (body?.error_code) {
        this.logger.warn(
          { url, errorCode: body.error_code, message: body.message },
          'SSO 验证被拒',
        )
        throw new SsoVerifyException(
          body.error_code,
          body.message ?? 'SSO 验证失败',
          body.status ?? 401,
        )
      }
      // 网络错误 / 超时 / 5xx → 记录完整诊断信息后视作不可用
      this.logger.error(
        {
          url,
          axiosCode: axiosErr.code,
          axiosMessage: axiosErr.message,
          httpStatus: axiosErr.response?.status,
          responseBody: axiosErr.response?.data,
        },
        'SSO verify 调用失败（网络/超时/非 error_code 错误）',
      )
      throw new SsoVerifyException(
        'SSO_UNAVAILABLE',
        `身份服务暂时不可用（${axiosErr.code ?? axiosErr.message ?? 'UNKNOWN'}）`,
      )
    }
  }
}
