/**
 * 回收站 Drizzle 仓储
 * by AI.Coding
 *
 * 直接操作 nodes 表 deletedAt 字段；用户视角下 trash = 软删的 nodes 子集。
 */
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray, isNotNull, isNull, lt, notInArray, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/mysql-core'
import type { DrizzleClient } from '../database/drizzle.client'
import { DRIZZLE_TOKEN } from '../database/database.tokens'
import {
  imageRefs,
  knownUsers,
  nodes,
  permissions,
  type NodeRow,
} from '../database/schema'

export interface TrashListRow {
  id: number
  parentId: number | null
  type: 'FOLDER' | 'DOC'
  name: string
  path: string
  creatorId: number
  creatorName: string | null
  deletedAt: Date
  deletedById: number | null
  deletedByName: string | null
}

@Injectable()
export class TrashRepo {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleClient) {}

  /**
   * 列出回收站。
   *
   * 关键约束："只显示软删子树的根"——即父节点未被一起软删的项。
   * 例如：删除整个文件夹 A 时，A 与 A 的所有后代都打了 deletedAt；
   * 但回收站里只列 A 一项，避免列表充斥子节点。
   *
   * 实现：self-join nodes 别名 parent_node，要求父为空或父 deletedAt 为空
   */
  async listVisible(filterCreatorId: number | null): Promise<TrashListRow[]> {
    const parentNode = alias(nodes, 'parent_node')
    const conds: SQL[] = [
      isNotNull(nodes.deletedAt),
      // 父为空（顶层）或 父未被软删
      or(isNull(nodes.parentId), isNull(parentNode.deletedAt)) as SQL,
    ]
    if (filterCreatorId !== null) {
      conds.push(eq(nodes.creatorId, filterCreatorId))
    }
    const rows = await this.db
      .select({
        id: nodes.id,
        parentId: nodes.parentId,
        type: nodes.type,
        name: nodes.name,
        path: nodes.path,
        creatorId: nodes.creatorId,
        creatorName: knownUsers.displayName,
        deletedAt: nodes.deletedAt,
        deletedById: nodes.deletedBy,
      })
      .from(nodes)
      .leftJoin(knownUsers, eq(nodes.creatorId, knownUsers.userId))
      .leftJoin(parentNode, eq(nodes.parentId, parentNode.id))
      .where(and(...conds))
      .orderBy(sql`${nodes.deletedAt} DESC`)

    // 二次查询删除者 displayName（与 creator 同表，写一个独立联接更乱）
    const deleterIds = Array.from(
      new Set(
        rows
          .map((r) => r.deletedById)
          .filter((id): id is number => id !== null && id !== undefined),
      ),
    )
    let deleterMap = new Map<number, string>()
    if (deleterIds.length > 0) {
      const ds = await this.db
        .select({ id: knownUsers.userId, n: knownUsers.displayName })
        .from(knownUsers)
        .where(inArray(knownUsers.userId, deleterIds))
      deleterMap = new Map(ds.map((r) => [r.id, r.n]))
    }

    return rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      type: (r.type as 'FOLDER' | 'DOC'),
      name: r.name,
      path: r.path,
      creatorId: r.creatorId,
      creatorName: r.creatorName,
      deletedAt: r.deletedAt as Date,
      deletedById: r.deletedById ?? null,
      deletedByName: r.deletedById !== null ? deleterMap.get(r.deletedById) ?? null : null,
    }))
  }

  /** 取单个回收站节点（已软删的） */
  async findDeletedById(id: number): Promise<NodeRow | null> {
    const rows = await this.db
      .select()
      .from(nodes)
      .where(and(eq(nodes.id, id), isNotNull(nodes.deletedAt)))
      .limit(1)
    return rows[0] ?? null
  }

  /** 是否存在某个 active 节点 */
  async existsActive(id: number): Promise<boolean> {
    const rows = await this.db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(eq(nodes.id, id), sql`${nodes.deletedAt} IS NULL`))
      .limit(1)
    return rows.length > 0
  }

  /**
   * 恢复一棵子树：把 path 前缀匹配的所有节点 deletedAt / deletedBy 置 null。
   * 若 newParentId 不同于原 parentId，则同时更新根节点的 parentId 与子树 path。
   */
  async restoreSubtree(rootPath: string): Promise<void> {
    const now = new Date()
    await this.db
      .update(nodes)
      .set({ deletedAt: null, deletedBy: null, updatedAt: now })
      .where(sql`(${nodes.path} = ${rootPath} OR ${nodes.path} LIKE ${`${rootPath}/%`})`)
  }

  /** 改根节点的 parentId（恢复到新位置时用） */
  async updateRootParent(id: number, parentId: number | null): Promise<void> {
    await this.db
      .update(nodes)
      .set({ parentId, updatedAt: new Date() })
      .where(eq(nodes.id, id))
  }

  /**
   * 同级（含软删）是否存在同名节点。
   * 恢复时为了避开 uk_parent_name 唯一索引（key 含 deleted_at），需要先查活的同级是否撞名。
   */
  async existsActiveSiblingByName(
    parentId: number | null,
    name: string,
    excludeId: number,
  ): Promise<boolean> {
    const conds: SQL[] = [
      eq(nodes.name, name),
      sql`${nodes.deletedAt} IS NULL`,
      sql`${nodes.id} <> ${excludeId}`,
    ]
    if (parentId === null) {
      conds.push(sql`${nodes.parentId} IS NULL`)
    } else {
      conds.push(eq(nodes.parentId, parentId))
    }
    const rows = await this.db.select({ id: nodes.id }).from(nodes).where(and(...conds)).limit(1)
    return rows.length > 0
  }

  /** 子树所有节点 id（彻底删除前预先扫，用于减少图片引用、删权限） */
  async listSubtreeIds(rootPath: string): Promise<{ id: number; type: string }[]> {
    return this.db
      .select({ id: nodes.id, type: nodes.type })
      .from(nodes)
      .where(sql`(${nodes.path} = ${rootPath} OR ${nodes.path} LIKE ${`${rootPath}/%`})`)
  }

  /** 物理删除一组 node 与其关联（权限 / 图片引用 / nodes 本身）；不删图片本身（由 service 负责） */
  async hardDeleteNodes(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    // 先删依赖：permissions / image_refs，再删 nodes
    await this.db.delete(permissions).where(inArray(permissions.nodeId, ids))
    await this.db.delete(imageRefs).where(inArray(imageRefs.docId, ids))
    await this.db.delete(nodes).where(inArray(nodes.id, ids))
  }

  /** 找出在子树 docs 中被引用但其它任何 active doc 不再引用的图片 */
  async findOrphanImageIdsForDocs(docIds: number[]): Promise<number[]> {
    if (docIds.length === 0) return []
    // 子查询：被删除 doc 引用的 image_id 集合
    const referencedRows = await this.db
      .selectDistinct({ id: imageRefs.imageId })
      .from(imageRefs)
      .where(inArray(imageRefs.docId, docIds))
    const candidateIds = referencedRows.map((r) => r.id)
    if (candidateIds.length === 0) return []
    // 找其中"除 docIds 外没有其它引用"的图片
    const stillRefRows = await this.db
      .selectDistinct({ id: imageRefs.imageId })
      .from(imageRefs)
      .where(
        and(
          inArray(imageRefs.imageId, candidateIds),
          notInArray(imageRefs.docId, docIds),
        ),
      )
    const stillRef = new Set(stillRefRows.map((r) => r.id))
    return candidateIds.filter((id) => !stillRef.has(id))
  }

  /** 30 天前软删的节点 id（按物化路径作为根的过滤交给 service） */
  async listExpiredDeleted(before: Date): Promise<{ id: number; path: string }[]> {
    return this.db
      .select({ id: nodes.id, path: nodes.path })
      .from(nodes)
      .where(and(isNotNull(nodes.deletedAt), lt(nodes.deletedAt, before)))
  }

  /** 用 path 找到当前激活的祖先 id（恢复时父被删 → 回根逻辑用） */
  async findActiveAncestorId(path: string): Promise<number | null> {
    const segs = path.split('/').filter(Boolean).map(Number).filter(Number.isFinite)
    if (segs.length <= 1) return null
    // 倒序检查祖先 id（不含自身）
    const ancestors = segs.slice(0, -1)
    const rows = await this.db
      .select({ id: nodes.id, deletedAt: nodes.deletedAt })
      .from(nodes)
      .where(inArray(nodes.id, ancestors))
    const stateMap = new Map(rows.map((r) => [r.id, r.deletedAt as Date | null]))
    // 自底向上找第一个 deletedAt 为 null 的
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const id = ancestors[i]
      if (id === undefined) continue
      if (!stateMap.has(id)) continue
      if (stateMap.get(id) === null) return id
    }
    return null
  }
}
