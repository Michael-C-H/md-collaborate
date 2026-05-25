/**
 * known_users 业务服务
 * by AI.Coding
 *
 * 包装 Repo 层并把数据库行映射为对外 VO（KnownUserVO）。
 */
import { Injectable } from '@nestjs/common'
import type { KnownUserVO } from '@app/shared'
import { NotFoundException } from '../common/exceptions/app.exception'
import type { KnownUserRow } from '../database/schema'
import type { SsoUser } from '../auth/sso-verify.client'
import { KnownUserRepo } from './known-user.repo'

/** 把 DB 行映射为对外 VO；非 ADMIN 的 role 一律归并为 USER */
function toVO(row: KnownUserRow): KnownUserVO {
  return {
    userId: row.userId,
    username: row.username,
    displayName: row.displayName,
    role: row.role === 'ADMIN' ? 'ADMIN' : 'USER',
  }
}

@Injectable()
export class KnownUserService {
  constructor(private readonly repo: KnownUserRepo) {}

  /** 登录时调用，写入/更新 known_users */
  async upsert(user: SsoUser): Promise<void> {
    await this.repo.upsert({
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    })
  }

  /** 模糊检索 */
  async searchByKeyword(keyword: string, limit: number): Promise<KnownUserVO[]> {
    const rows = await this.repo.searchByKeyword(keyword, limit)
    return rows.map(toVO)
  }

  /** 精确查询；未登录过本系统的 username 直接 NotFound（分享面板用） */
  async findByUsername(username: string): Promise<KnownUserVO> {
    const row = await this.repo.findByUsername(username)
    if (!row) {
      throw new NotFoundException(`用户 ${username} 尚未访问本系统`)
    }
    return toVO(row)
  }
}
