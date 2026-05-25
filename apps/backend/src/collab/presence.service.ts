/**
 * 协同在线状态服务
 * by AI.Coding
 *
 * Redis Set 记录每个文档的"编辑者" user_id 集合，用于：
 *   1. 单文档并发上限校验（≤10 编辑者）
 *   2. 协作者实时感知（前端通过 yjs awareness 自行得到，本服务只服务于上限计数）
 *
 * Key 设计：editors:{docId}（Set，元素是 userId 字符串）
 */
import { Inject, Injectable } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS_TOKEN } from '../redis/redis.tokens'

@Injectable()
export class PresenceService {
  constructor(@Inject(REDIS_TOKEN) private readonly redis: Redis) {}

  private key(docId: number): string {
    return `editors:${docId}`
  }

  /** 当前正在编辑该文档的不重复用户数 */
  async countUniqueEditors(docId: number): Promise<number> {
    return this.redis.scard(this.key(docId))
  }

  /** 该用户是否已经是此文档的编辑者 */
  async isEditor(docId: number, userId: number): Promise<boolean> {
    const exists = await this.redis.sismember(this.key(docId), String(userId))
    return exists === 1
  }

  /** 加入编辑者集合（多端登录的同一 userId 共用一个名额） */
  async addEditor(docId: number, userId: number): Promise<void> {
    await this.redis.sadd(this.key(docId), String(userId))
  }

  /** 离开编辑者集合 */
  async removeEditor(docId: number, userId: number): Promise<void> {
    await this.redis.srem(this.key(docId), String(userId))
  }

  /** 清空某文档的编辑者集合（如文档被删除时调用） */
  async clearDocument(docId: number): Promise<void> {
    await this.redis.del(this.key(docId))
  }
}
