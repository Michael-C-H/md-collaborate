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
    userId: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role === 'ADMIN' ? 'ADMIN' : 'USER',
    loginType: (row.loginType as 'SSO' | 'LOCAL') ?? 'SSO',
  }
}

@Injectable()
export class KnownUserService {
  constructor(private readonly repo: KnownUserRepo) {}

  /** SSO 登录时调用，写入/更新 known_users */
  async upsertSso(user: SsoUser): Promise<void> {
    await this.repo.upsertSso({
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    })
  }

  /** 创建本地用户 */
  async createLocal(input: {
    username: string
    passwordHash: string
    displayName?: string
    role?: string
  }): Promise<KnownUserVO> {
    const row = await this.repo.createLocal({
      username: input.username,
      passwordHash: input.passwordHash,
      displayName: input.displayName ?? input.username,
      role: input.role ?? 'USER',
    })
    return toVO(row)
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

  /** 按 id 查询；不存在抛 NotFound */
  async findById(id: number): Promise<KnownUserVO> {
    const row = await this.repo.findById(id)
    if (!row) {
      throw new NotFoundException(`用户 ${id} 不存在`)
    }
    return toVO(row)
  }

  /** 更新用户（管理员用） */
  async updateUser(id: number, input: {
    displayName?: string
    role?: string
    passwordHash?: string
  }): Promise<KnownUserVO> {
    const row = await this.repo.findById(id)
    if (!row) {
      throw new NotFoundException(`用户 ${id} 不存在`)
    }
    await this.repo.updateById(id, input)
    const updated = await this.repo.findById(id)
    return toVO(updated!)
  }

  /** 删除用户（管理员用） */
  async deleteUser(id: number): Promise<void> {
    const row = await this.repo.findById(id)
    if (!row) {
      throw new NotFoundException(`用户 ${id} 不存在`)
    }
    await this.repo.deleteById(id)
  }

  /** 分页查询用户列表（管理员用） */
  async listUsers(page: number, pageSize: number, keyword?: string) {
    const result = await this.repo.findAllPaginated(page, pageSize, keyword)
    return {
      total: result.total,
      list: result.list.map(toVO),
    }
  }

  /** 按用户名查找本地用户（登录验证用，返回原始行含 passwordHash） */
  async findLocalByUsername(username: string): Promise<KnownUserRow | null> {
    const row = await this.repo.findByUsername(username)
    if (!row || row.loginType !== 'LOCAL') return null
    return row
  }

  /** 按 id 查询原始行（内部用） */
  async findRowById(id: number): Promise<KnownUserRow | null> {
    return this.repo.findById(id)
  }

  /** 按用户名查询原始行（内部用，不限登录类型） */
  async findRowByUsername(username: string): Promise<KnownUserRow | null> {
    return this.repo.findByUsername(username)
  }
}
