/**
 * Drizzle MySQL 表结构定义
 * by AI.Coding
 *
 * 共 7 张表，对应 design.md 数据模型章节：
 *   known_users   已登录用户缓存（非用户体系）
 *   nodes         文档与文件夹（含 yjs_state 二进制 doc state）
 *   permissions   文档/文件夹权限
 *   snapshots     版本快照
 *   images        图片元数据
 *   image_refs    图片在文档中的引用（复合主键）
 *   operation_log 操作审计日志
 *
 * 注意：drizzle-orm/mysql-core 未直接提供 longblob 类型，这里通过 customType 扩展。
 */
import {
  bigint,
  char,
  customType,
  datetime,
  index,
  json,
  longtext,
  mysqlTable,
  primaryKey,
  tinyint,
  unique,
  varchar,
} from 'drizzle-orm/mysql-core'

// ── 自定义类型：MySQL LONGBLOB ──────────────────────────────────
const longblob = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'longblob'
  },
})

// ─────────────────────────────────────────────────────────────────
// known_users — 已登录用户缓存
// ─────────────────────────────────────────────────────────────────
export const knownUsers = mysqlTable(
  'known_users',
  {
    /** 来自 SSO verify 的 userId，全系统通用主键 */
    userId: bigint('user_id', { mode: 'number' }).primaryKey().notNull(),
    /** SSO username，唯一 */
    username: varchar('username', { length: 64 }).notNull().unique('uk_username'),
    /** SSO displayName，用于头像与展示 */
    displayName: varchar('display_name', { length: 128 }).notNull(),
    /** SSO role；仅 'ADMIN' 触发超级管理员，其他视为普通用户 */
    role: varchar('role', { length: 32 }).notNull(),
    firstLoginAt: datetime('first_login_at', { fsp: 3 }).notNull(),
    lastLoginAt: datetime('last_login_at', { fsp: 3 }).notNull(),
  },
  (t) => ({
    idxDisplayName: index('idx_display_name').on(t.displayName),
    idxRole: index('idx_role').on(t.role),
  }),
)

// ─────────────────────────────────────────────────────────────────
// nodes — 文档与文件夹（邻接表 + 物化路径）
// ─────────────────────────────────────────────────────────────────
export const nodes = mysqlTable(
  'nodes',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    /** 根节点为 null */
    parentId: bigint('parent_id', { mode: 'number' }),
    /** 'FOLDER' / 'DOC' */
    type: varchar('type', { length: 8 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    /**
     * 物化路径如 "/3/9/12"，用于深度校验、级联软删/恢复。
     * 设计文档原写 varchar(2048)，但 utf8mb4 全字段索引超过 InnoDB 3072 字节上限；
     * 实际 5 层深度 × ~20 字符 ≈ 100 字符已足够，缩短到 512 后既可全字段索引、又留充足余量。
     */
    path: varchar('path', { length: 512 }).notNull(),
    /** 0=根，最大 5 */
    depth: tinyint('depth').notNull(),
    creatorId: bigint('creator_id', { mode: 'number' }).notNull(),

    /** 仅 DOC：Hocuspocus onStoreDocument 写入的最新 MD 文本 */
    currentContent: longtext('current_content'),
    contentUpdatedAt: datetime('content_updated_at', { fsp: 3 }),
    /** 仅 DOC：Hocuspocus 持久化的 yjs 二进制 doc state */
    yjsState: longblob('yjs_state'),

    createdAt: datetime('created_at', { fsp: 3 }).notNull(),
    updatedAt: datetime('updated_at', { fsp: 3 }).notNull(),
    /** 软删时间；非 null 表示已进入回收站 */
    deletedAt: datetime('deleted_at', { fsp: 3 }),
    deletedBy: bigint('deleted_by', { mode: 'number' }),
  },
  (t) => ({
    idxParent: index('idx_parent').on(t.parentId, t.deletedAt),
    // path 已缩短至 varchar(512)，可直接做全字段 BTREE 索引
    idxPath: index('idx_path').on(t.path),
    // 同级唯一；软删后允许重名（deleted_at 不同）
    ukParentName: unique('uk_parent_name').on(t.parentId, t.name, t.deletedAt),
    idxDeletedAt: index('idx_deleted_at').on(t.deletedAt),
  }),
)

// ─────────────────────────────────────────────────────────────────
// permissions — 文档/文件夹权限
// ─────────────────────────────────────────────────────────────────
export const permissions = mysqlTable(
  'permissions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    nodeId: bigint('node_id', { mode: 'number' }).notNull(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    /** 'READ' / 'WRITE' / 'MANAGE' */
    role: varchar('role', { length: 16 }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).notNull(),
    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  },
  (t) => ({
    ukNodeUser: unique('uk_node_user').on(t.nodeId, t.userId),
    idxUser: index('idx_user').on(t.userId),
  }),
)

// ─────────────────────────────────────────────────────────────────
// snapshots — 版本快照
// ─────────────────────────────────────────────────────────────────
export const snapshots = mysqlTable(
  'snapshots',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    docId: bigint('doc_id', { mode: 'number' }).notNull(),
    /** 同 doc 自增版本号（应用层维护，1 起） */
    versionNo: bigint('version_no', { mode: 'number' }).notNull(),
    /** 'AUTO' / 'MANUAL' / 'RESTORE_FROM' */
    type: varchar('type', { length: 16 }).notNull(),
    /** 仅 MANUAL 有 */
    name: varchar('name', { length: 50 }),
    /** 仅 RESTORE_FROM 有，指向被恢复的 version_no */
    restoredFrom: bigint('restored_from', { mode: 'number' }),
    /** 完整 Markdown 文本，来自 Hocuspocus 同步出的权威文本 */
    content: longtext('content').notNull(),
    /** content 的 SHA-256，便于 AUTO 跳过无变化 */
    contentHash: char('content_hash', { length: 64 }).notNull(),
    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).notNull(),
    /** AUTO = created_at + 90d；MANUAL/RESTORE_FROM = null（永久保留） */
    expiresAt: datetime('expires_at', { fsp: 3 }),
  },
  (t) => ({
    ukDocVersion: unique('uk_doc_version').on(t.docId, t.versionNo),
    idxExpires: index('idx_expires').on(t.expiresAt),
    idxDocType: index('idx_doc_type').on(t.docId, t.type),
  }),
)

// ─────────────────────────────────────────────────────────────────
// images — 图片元数据
// ─────────────────────────────────────────────────────────────────
export const images = mysqlTable('images', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  /** 不可猜测的 URL token */
  urlToken: char('url_token', { length: 32 }).notNull().unique('uk_url_token'),
  /** 相对上传根目录路径 */
  storagePath: varchar('storage_path', { length: 512 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type', { length: 64 }).notNull(),
  uploaderId: bigint('uploader_id', { mode: 'number' }).notNull(),
  createdAt: datetime('created_at', { fsp: 3 }).notNull(),
})

// ─────────────────────────────────────────────────────────────────
// image_refs — 图片引用计数（用于回收清理时统计是否还被使用）
// ─────────────────────────────────────────────────────────────────
export const imageRefs = mysqlTable(
  'image_refs',
  {
    imageId: bigint('image_id', { mode: 'number' }).notNull(),
    docId: bigint('doc_id', { mode: 'number' }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ name: 'pk_image_refs', columns: [t.imageId, t.docId] }),
  }),
)

// ─────────────────────────────────────────────────────────────────
// operation_log — 操作审计
// ─────────────────────────────────────────────────────────────────
export const operationLog = mysqlTable(
  'operation_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    /** 动作字符串，如 NODE_DELETE / SNAPSHOT_RESTORE / PERMISSION_GRANT */
    action: varchar('action', { length: 64 }).notNull(),
    /** 目标类型，如 NODE / SNAPSHOT / PERMISSION / USER */
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: bigint('target_id', { mode: 'number' }),
    /** 上下文 JSON（新旧值、相关 ID 等） */
    detail: json('detail'),
    createdAt: datetime('created_at', { fsp: 3 }).notNull(),
  },
  (t) => ({
    idxUserTime: index('idx_user_time').on(t.userId, t.createdAt),
    idxAction: index('idx_action').on(t.action),
  }),
)

// ── 类型导出（其他模块可 import 使用） ──────────────────────────
export type KnownUserRow = typeof knownUsers.$inferSelect
export type KnownUserInsert = typeof knownUsers.$inferInsert
export type NodeRow = typeof nodes.$inferSelect
export type NodeInsert = typeof nodes.$inferInsert
export type PermissionRow = typeof permissions.$inferSelect
export type PermissionInsert = typeof permissions.$inferInsert
export type SnapshotRow = typeof snapshots.$inferSelect
export type SnapshotInsert = typeof snapshots.$inferInsert
export type ImageRow = typeof images.$inferSelect
export type ImageInsert = typeof images.$inferInsert
export type ImageRefRow = typeof imageRefs.$inferSelect
export type ImageRefInsert = typeof imageRefs.$inferInsert
export type OperationLogRow = typeof operationLog.$inferSelect
export type OperationLogInsert = typeof operationLog.$inferInsert
