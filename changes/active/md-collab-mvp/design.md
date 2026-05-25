> 来源: spec.md（含 Delta：头像本地生成、SSO 协议适配 & 超级管理员）
> 生成时间: 2026-05-13
> 阶段: design
> 注: 第二版（全量重写）。第一版基于 Java 17 + Spring Boot；技术栈讨论后整体切换为 Node 20 + NestJS + Hocuspocus。

# 在线多人协作 MD 编辑器 — 技术设计

## Why

### 背景与现状

零代码起步的新项目。目标交付一个 B/S 协作 MD 编辑器，部署在企业局域网内，复用现有 SSO（自定义 ssoToken 协议），承载 ≤100 并发用户、≤10 人单文档并发。spec 已锁定 19 项功能、明确边界与失败处理。

### 设计目标 / 非目标

| 类型 | 说明 |
|------|------|
| ✅ 目标 | 服务端权威解析 CRDT 文档状态（Hocuspocus），消除"客户端崩溃丢字"的风险 |
| ✅ 目标 | 前后端类型共享（Zod schemas in `packages/shared`），接口契约不漂移 |
| ✅ 目标 | 单实例承载 ≤100 在线 / ≤10 人单文档并发 |
| ✅ 目标 | 安全可控：clientSecret 外置、ADMIN 操作有审计、权限校验集中于 Guard |
| ✅ 目标 | 运维简洁：单 Node 进程 + MySQL/Redis/本地文件，docker-compose 一键起 |
| ❌ 非目标 | 公网部署、多租户、横向扩展、离线编辑、跨实例同步 |
| ❌ 非目标 | 替代 SSO 的认证、二次密码、独立用户管理 |
| ❌ 非目标 | 富文本（仅 Markdown）、移动端原生 App |

## What

### 技术方案

#### 技术栈总览

| 层 | 选型 |
|---|------|
| Runtime | Node.js 20 LTS + TypeScript 5 |
| 后端框架 | NestJS 10（模块化 + DI + Guard + Interceptor + ExceptionFilter） |
| 协同服务 | Hocuspocus（嵌入 NestJS 同进程，挂在 WS adapter 上） |
| ORM / Schema | Drizzle ORM + drizzle-kit（MySQL 方言） |
| 校验 | Zod（schemas 位于 `packages/shared`，前后端共用） |
| Session | iron-session（加密 cookie）+ Redis 备份用户数据 |
| Markdown | unified + remark + rehype（导入解析、AST 操作） |
| PDF | Playwright (Chromium headless) 跑在 worker_threads pool，**与主事件循环隔离** |
| ZIP | `unzipper`（流式解包）+ `archiver`（打包） |
| 图片 | sharp（可选压缩/缩略图，MVP 仅做格式校验和透传） |
| 日志 | pino（生产 JSON，开发 pretty） |
| 测试 | vitest + supertest（@nestjs/testing） |
| 数据库 | MySQL 8 |
| 缓存 / 在线状态 | Redis 7 |
| 前端 | Vue 3 + TS + Vite + Pinia + Vue Router + Tiptap + yjs + y-prosemirror |
| 包管理 | pnpm + workspaces（monorepo） |
| 部署 | Docker Compose（MySQL + Redis + app + Nginx） |

#### 仓库结构（monorepo）

```
md-collab/
├── apps/
│   ├── backend/         # NestJS + Hocuspocus
│   └── frontend/        # Vue 3
├── packages/
│   └── shared/          # Zod schemas + 共享 TS 类型
├── docker/
│   ├── nginx.conf
│   └── ...
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── .env.example
```

`packages/shared` 被 `apps/backend` 和 `apps/frontend` 通过 workspace alias 引入。任何 API DTO 的定义只写一次。

#### 架构决策

**整体形态**：单 Node 进程同时承载 REST（NestJS HTTP）+ WebSocket（Hocuspocus 挂载在 NestJS WsAdapter）+ 定时任务（@nestjs/schedule）+ PDF Worker Pool。Nginx 反代静态资源、`/api/*`、`/ws/*`。

**后端 NestJS 模块划分**：

| 模块 | 职责 | 依赖 |
|------|------|------|
| `AppModule` | 全局编排、ConfigModule、DatabaseModule 引入 | — |
| `CommonModule` | ApiResult 包装、ZodValidationPipe、ZodExceptionFilter、CurrentUser 装饰器 | — |
| `ConfigModule` | `@nestjs/config` + Zod 解析 env，提供强类型 `AppConfig` | — |
| `DatabaseModule` | Drizzle client provider，schema 注册 | Config |
| `RedisModule` | ioredis 单例，被 Session/Presence 等共用 | Config |
| `AuthModule` | `SsoTokenMiddleware`、`AuthService`、`SsoVerifyClient`、`SessionGuard`（默认全局守卫） | Config, User, Common |
| `UserModule` | known_users repo、检索 | Database, Auth |
| `NodeModule` | 文档/文件夹 CRUD、邻接表+物化路径、文档当前内容读写 | Database, Permission |
| `PermissionModule` | 权限 repo、`PermissionGuard`、`RequirePermission` 装饰器（含 ADMIN 旁路） | Database, Auth |
| `CollabModule` | Hocuspocus server 集成、四个钩子（auth / connect / change / store） | Auth, Permission, Node, Snapshot |
| `SnapshotModule` | 快照 CRUD + 恢复 + 定时任务（AUTO 生成、过期清理） | Database, Node |
| `ImageModule` | 上传、存储、引用计数 | Database |
| `ImExportModule` | MD/ZIP 导入、MD 导出、PDF 导出（worker pool） | Node, Image |
| `TrashModule` | 回收站列表/恢复/彻底删除 + 定时清理 | Database, Node, Image, Permission |
| `AuditModule` | 操作日志写入 + 查询；提供 `AuditInterceptor` 自动记录写操作 | Database |

**前端 Vue 3 模块划分**：

| 模块 | 职责 |
|------|------|
| `router/` | beforeEach 守卫（无会话 → 显示等待重定向 / LoginErrorView） |
| `stores/` | Pinia: `currentUser`、`currentDoc`、`collabPresence` |
| `api/` | axios 实例（统一拦截 401 / 403 / 5xx），按模块拆 `auth.api.ts` 等；类型从 `@app/shared` 引入 |
| `components/UserAvatar` | 头像组件（F18） |
| `components/DocTree` | 文档树（展开/拖拽/右键菜单/新建对话框） |
| `components/Editor` | Tiptap 壳 + yjs binding + 工具栏 + Mermaid/Math 扩展 + 图片上传扩展 |
| `components/SharePanel` | 分享面板（known_users 检索 + 精确匹配 + 提示） |
| `components/VersionPanel` | 版本时间线 + 预览 + 恢复确认 |
| `components/TrashPanel` | 回收站（普通 / ADMIN 视图切换） |
| `views/EditorView` | 左树 + 右编辑器布局 |
| `views/TrashView` | 回收站页 |
| `views/LoginErrorView` | SSO 失效提示页（根据 `?code` 显示对应文案） |

**模块关系（文字图）**：

```
Browser
  │
  ├─ HTTPS ──> Nginx ──┬── 静态 (apps/frontend dist)
  │                    ├── /api/*  ──> NestJS HTTP
  │                    └── /ws/*   ──> NestJS WsAdapter ──> Hocuspocus Server
  │
  NestJS process
    ├─ AuthModule        ──> SSO /api/sso/verify
    ├─ Drizzle ───────────> MySQL（known_users / nodes / permissions / snapshots / images / image_refs / operation_log）
    ├─ Redis ─────────────> Session backup + Presence + 定时任务锁
    ├─ ImageStorage ──────> 本地 FS（图片）
    ├─ Hocuspocus server ─> y-doc 内存状态 + 周期持久化（onStoreDocument 钩子写 MySQL）
    └─ Playwright Worker Pool ─> PDF 渲染
```

#### 数据模型变更

> 全部为新建表。MySQL 8 / utf8mb4_0900_ai_ci。主键 bigint AUTO_INCREMENT。时间字段 `datetime(3)`。Drizzle schema 位于 `apps/backend/src/database/schema.ts`，迁移走 `drizzle-kit generate` + `drizzle-kit migrate`。

##### `known_users` — 已登录用户缓存（非用户体系）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| user_id | bigint | PK | 来自 SSO verify 的 userId |
| username | varchar(64) | UNIQUE NOT NULL | SSO username |
| display_name | varchar(128) | NOT NULL | SSO displayName，用于头像与展示 |
| role | varchar(32) | NOT NULL | 仅 `ADMIN` 触发超级管理员 |
| first_login_at | datetime(3) | NOT NULL | |
| last_login_at | datetime(3) | NOT NULL | |

索引：`idx_display_name (display_name)`、`idx_role (role)`。

##### `nodes` — 文档与文件夹

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | bigint | PK | |
| parent_id | bigint | NULL | 根节点为 NULL |
| type | varchar(8) | NOT NULL | `FOLDER` / `DOC` |
| name | varchar(100) | NOT NULL | 见 spec 命名约束 |
| path | varchar(512) | NOT NULL | 物化路径如 `/3/9/12`。5 层深度内仅 ~100 字符，缩短至 512 以便全字段索引（utf8mb4 下 512×4=2048 字节 < InnoDB 3072 限制） |
| depth | tinyint | NOT NULL | 0=根，最大 5 |
| creator_id | bigint | NOT NULL | FK → known_users.user_id |
| current_content | longtext | NULL | 仅 DOC：Hocuspocus onStoreDocument 写入的最新 MD 文本 |
| content_updated_at | datetime(3) | NULL | 仅 DOC：current_content 最近更新时间 |
| yjs_state | longblob | NULL | 仅 DOC：Hocuspocus 持久化的 yjs 二进制 doc state（重启后可恢复 CRDT 上下文） |
| created_at | datetime(3) | NOT NULL | |
| updated_at | datetime(3) | NOT NULL | |
| deleted_at | datetime(3) | NULL | 非 NULL = 软删 |
| deleted_by | bigint | NULL | |

索引：`idx_parent (parent_id, deleted_at)`、`idx_path (path)`（全字段）、`uk_parent_name (parent_id, name, deleted_at)`（软删后允许重名）、`idx_deleted_at (deleted_at)`。

> **变更点（相比第一版 Java design）**：新增 `yjs_state longblob` 字段。Hocuspocus 持久化二进制 doc state，重启后协同会话可无缝恢复；`current_content` 仍保留作为 MD 文本镜像，供导出 / 列表 / 全文级查询使用。

##### `permissions` — 文档/文件夹权限

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | bigint | PK | |
| node_id | bigint | NOT NULL | FK → nodes.id |
| user_id | bigint | NOT NULL | FK → known_users.user_id |
| role | varchar(16) | NOT NULL | `READ` / `WRITE` / `MANAGE` |
| created_at | datetime(3) | NOT NULL | |
| created_by | bigint | NOT NULL | 授权人 |

索引：`uk_node_user (node_id, user_id)`、`idx_user (user_id)`。

##### `snapshots` — 版本快照

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | bigint | PK | |
| doc_id | bigint | NOT NULL | FK → nodes.id |
| version_no | int | NOT NULL | 每个 doc_id 自增（应用层维护，1 起） |
| type | varchar(16) | NOT NULL | `AUTO` / `MANUAL` / `RESTORE_FROM` |
| name | varchar(50) | NULL | 仅 MANUAL 有 |
| restored_from | int | NULL | 仅 RESTORE_FROM 有 |
| content | longtext | NOT NULL | 完整 MD 文本（来自 Hocuspocus 同步出的权威文本） |
| content_hash | char(64) | NOT NULL | SHA-256，AUTO 比对去重 |
| created_by | bigint | NOT NULL | |
| created_at | datetime(3) | NOT NULL | |
| expires_at | datetime(3) | NULL | AUTO = created_at + 90d；MANUAL/RESTORE_FROM = NULL |

索引：`uk_doc_version (doc_id, version_no)`、`idx_expires (expires_at)`、`idx_doc_type (doc_id, type)`。

##### `images` / `image_refs` / `operation_log`

字段与第一版完全相同：

- `images(id, url_token UQ, storage_path, size_bytes, mime_type, uploader_id, created_at)`
- `image_refs(image_id, doc_id, created_at)` 复合主键
- `operation_log(id, user_id, action, target_type, target_id, detail json, created_at)`

#### 接口定义

> 全部 REST 走 `/api`，统一返回 `ApiResult<T>`。WebSocket 走 `/ws/docs/{id}`（Hocuspocus 协议）。
> DTO 用 Zod schema 定义在 `packages/shared/src/schemas/*.ts`，通过 `z.infer` 派生 TS 类型，**前后端共用同一份**。
> 后端 Controller 用 `@UsePipes(new ZodValidationPipe(schema))` 解析。

##### 共享类型示意（位置：`packages/shared/src/schemas/*`）

```ts
// auth.ts
export const CurrentUserSchema = z.object({
  userId: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(['ADMIN', 'USER']),  // 非 ADMIN 一律归 USER
});
export type CurrentUser = z.infer<typeof CurrentUserSchema>;

// node.ts
export const NodeTypeSchema = z.enum(['FOLDER', 'DOC']);
export const CreateNodeSchema = z.object({
  parentId: z.number().int().nullable(),
  type: NodeTypeSchema,
  name: z.string().min(1).max(100).regex(/^[^/\\:*?"<>|]+$/),
});

// permission.ts
export const RoleSchema = z.enum(['READ', 'WRITE', 'MANAGE']);

// ... 其余模块同理
```

##### Auth — `AuthModule`

| 接口 | 方法 | 路径 / 签名 | 入参 | 出参 | 说明 |
|------|------|----------|------|------|------|
| SSO 拦截 | Middleware | `SsoTokenMiddleware.use` | URL `?ssoToken=` | 302 重定向 | 应用为 global middleware；命中 ssoToken 时调 verify、建立 iron-session、302 去参数 |
| 当前用户 | GET | `/api/auth/me` | — | `ApiResult<CurrentUser>` | 无会话返回 401 |
| 登出 | POST | `/api/auth/logout` | — | `ApiResult<{ redirectUrl: string }>` | 销毁 session；redirectUrl 来自配置 |

关键服务签名：

```ts
class SsoVerifyClient {
  verify(ssoToken: string): Promise<SsoUser>  // 失败抛 SsoVerifyException（含 error_code）
}

class AuthService {
  handleSsoToken(ssoToken: string, session: IronSession): Promise<CurrentUser>
  currentUser(session: IronSession): CurrentUser | null
  logout(session: IronSession): Promise<{ redirectUrl: string }>
}

class KnownUserService {
  upsert(user: SsoUser): Promise<void>
  searchByKeyword(q: string, limit: number): Promise<KnownUser[]>
  findByUsername(username: string): Promise<KnownUser | null>
  findById(userId: number): Promise<KnownUser | null>
}
```

##### User

| 接口 | 方法 | 路径 | 入参 | 出参 | 说明 |
|------|------|------|------|------|------|
| 模糊检索 | GET | `/api/users/search` | `q, limit=20` | `ApiResult<KnownUser[]>` | LIKE display_name / username |
| 精确查询 | GET | `/api/users/by-username/:username` | path | `ApiResult<KnownUser>` or 404 | 分享面板 "未登录用户" 判定 |

##### Node — 文档树 / 文档内容

| 接口 | 方法 | 路径 | 入参 | 出参 | 说明 |
|------|------|------|------|------|------|
| 树查询 | GET | `/api/nodes/tree` | — | `ApiResult<NodeTree[]>` | 仅返回当前用户有 READ / 创建者 / ADMIN 可见的节点（子树过滤） |
| 节点详情 | GET | `/api/nodes/:id` | path | `ApiResult<NodeDetail>` | |
| 创建 | POST | `/api/nodes` | `CreateNodeDto` | `ApiResult<Node>` | 创建时同步建 MANAGE 权限给当前用户 |
| 重命名 / 移动 | PATCH | `/api/nodes/:id` | `UpdateNodeDto { name?, parentId? }` | `ApiResult<Node>` | 移动时校验目标子树深度 ≤ 5 |
| 软删 | DELETE | `/api/nodes/:id` | path | `ApiResult<void>` | 级联软删整棵子树（path 前缀匹配） |
| 文档内容查询 | GET | `/api/docs/:id/content` | path | `ApiResult<DocContent>` | 返回 current_content（用于离线预览 / 导出菜单初始化） |

> **关键变更**：取消第一版的 `PUT /api/docs/:id/content` 客户端上报接口。文档内容的权威更新通道由 Hocuspocus 的 `onStoreDocument` 钩子统一写入 `current_content` + `yjs_state`。前端不再直接 PUT 文本。

关键服务签名：

```ts
class NodeService {
  loadTree(currentUserId: number, isAdmin: boolean): Promise<NodeTree[]>
  create(currentUserId: number, dto: CreateNodeDto): Promise<Node>
  rename(currentUserId: number, nodeId: number, newName: string): Promise<Node>
  move(currentUserId: number, nodeId: number, newParentId: number | null): Promise<Node>
  softDelete(currentUserId: number, nodeId: number): Promise<void>
  loadContent(currentUserId: number, docId: number): Promise<DocContent>
}

class NodePathHelper {
  buildPath(parentPath: string | null, selfId: number): string
  computeDepth(path: string): number
  rewriteSubtreePaths(rootNodeId: number, newPathPrefix: string): Promise<void>
}
```

##### Permission

| 接口 | 方法 | 路径 | 入参 | 出参 | 说明 |
|------|------|------|------|------|------|
| 协作者列表 | GET | `/api/nodes/:id/permissions` | path | `ApiResult<Permission[]>` | 仅 MANAGE / ADMIN |
| 授权 / 改权限 | PUT | `/api/nodes/:id/permissions/:userId` | `{ role: Role }` | `ApiResult<Permission>` | upsert；userId 必须在 known_users |
| 撤权 | DELETE | `/api/nodes/:id/permissions/:userId` | path | `ApiResult<void>` | 创建者撤自己 MANAGE 时返回 400 |

NestJS 权限切面：

```ts
// require-permission.decorator.ts
export const RequirePermission = (minRole: 'READ' | 'WRITE' | 'MANAGE') =>
  SetMetadata('requirePermission', minRole)

// permission.guard.ts
class PermissionGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): Promise<boolean>
  // 1. 解析 metadata 拿 minRole
  // 2. 拿 currentUser；role==='ADMIN' 直接 true
  // 3. 从 params 取 nodeId / docId
  // 4. 查 permissions 表对比 minRole
}
```

Controller 使用：

```ts
@Get(':id')
@RequirePermission('READ')
@UseGuards(PermissionGuard)
findOne(@Param('id') id: number) { ... }
```

##### Collab — Hocuspocus

| 端点 | 协议 | 说明 |
|------|------|------|
| `WS /ws/docs/:docId` | Hocuspocus 协议（基于 y-protocols） | 由 Hocuspocus Server 直接处理；NestJS 仅做 WsAdapter 挂载 |

四个核心钩子（位于 `apps/backend/src/collab/hooks/`）：

```ts
// onAuthenticate: 校验客户端从 query/header 传来的 sessionId / cookie；查 Redis 拿 user；拒绝匿名
async function onAuthenticate(data: onAuthenticatePayload): Promise<{ user: CurrentUser }>

// onConnect: 拿到 docId、user；查权限：无 READ 直接 reject；
//            若 user 有 WRITE+ 且当前编辑者已 10 → 标记此连接为 readOnly（context.readOnly = true）
async function onConnect(data: onConnectPayload): Promise<void>

// onChange: 客户端有 update 进来时触发；用于 awareness / presence 旁路，**不**触发持久化
async function onChange(data: onChangePayload): Promise<void>

// onStoreDocument: Hocuspocus debounce 后调用（默认 2 秒）；序列化 yjs state + 文本 → 写 nodes.yjs_state / current_content
async function onStoreDocument(data: onStoreDocumentPayload): Promise<void>
```

CollabRoomRegistry 用 Redis 维护 `editors:{docId}` Set（值为 userId），用于并发上限校验。同一 userId 多 tab 共享一个编辑名额。

##### Snapshot

| 接口 | 方法 | 路径 | 入参 | 出参 | 说明 |
|------|------|------|------|------|------|
| 列表 | GET | `/api/docs/:id/snapshots` | path | `ApiResult<Snapshot[]>` | 倒序 |
| 详情 | GET | `/api/docs/:id/snapshots/:versionNo` | path | `ApiResult<SnapshotContent>` | |
| 手动创建 | POST | `/api/docs/:id/snapshots` | `{ name }` | `ApiResult<Snapshot>` | type=MANUAL；≤100 校验 |
| 恢复 | POST | `/api/docs/:id/snapshots/:versionNo/restore` | `{ force?: boolean }` | `ApiResult<Snapshot>` | editorCount>0 且 !force → 409；恢复时通过 Hocuspocus 替换 yjs doc 内容并广播 |

定时任务（@nestjs/schedule + Redis 锁防多实例）：

```ts
@Cron('0 */1 * * * *')   // 每分钟
async autoSnapshotTick()  // 扫近 5 分钟有 content_updated_at 的 doc，hash 不同则建 AUTO

@Cron('0 0 3 * * *')      // 每日 03:00
async snapshotCleanupTick()  // 清理 expires_at < now 的 AUTO
```

恢复实现要点（与第一版差异）：

```ts
class SnapshotService {
  async restore(currentUserId: number, docId: number, versionNo: number, force: boolean): Promise<Snapshot>
  // 1. 查在线编辑者数；>0 且 !force → throw ConflictException
  // 2. 取 snapshot.content
  // 3. 调 hocuspocus.openDocument(docId) 拿 yDoc
  // 4. yDoc.transact(() => { ytext.delete(0, ytext.length); ytext.insert(0, content) })
  //    （Hocuspocus 会自动 broadcast 给所有在线客户端）
  // 5. 建一条 type=RESTORE_FROM 的快照行
}
```

##### Image

| 接口 | 方法 | 路径 | 入参 | 出参 | 说明 |
|------|------|------|------|------|------|
| 上传 | POST | `/api/images` | multipart `file` + `docId` | `ApiResult<{ url, urlToken }>` | 校验大小/格式；写 images + image_refs |
| 读取 | GET | `/api/images/:urlToken` | path | binary stream | 局域网无防盗链 |

##### ImExport

| 接口 | 方法 | 路径 | 入参 | 出参 | 说明 |
|------|------|------|------|------|------|
| 导入 md | POST | `/api/imports/md` | multipart `file` + `parentId?` | `ApiResult<ImportResult>` | 单文件 ≤5 MB |
| 导入 zip | POST | `/api/imports/zip` | multipart `file` + `parentId?` | `ApiResult<ImportResult>` | ≤50 MB；全量校验后再写入 |
| 导出 md | GET | `/api/docs/:id/export.md` | path | `text/markdown` 流 | 取 current_content |
| 导出 pdf | GET | `/api/docs/:id/export.pdf` | path | `application/pdf` 流 | 后端用 Playwright worker 渲染（注入文档 HTML + 通用样式 + Mermaid/KaTeX 客户端脚本） |

> **关键变更（相比第一版）**：PDF 导出改为**后端独立完成**，前端只发请求拿流。Playwright headless Chromium 在 worker_threads pool 中跑（最大 2 个并发渲染器），避免阻塞主事件循环。

##### Trash

| 接口 | 方法 | 路径 | 入参 | 出参 | 说明 |
|------|------|------|------|------|------|
| 列表 | GET | `/api/trash` | `scope=mine \| all` | `ApiResult<TrashItem[]>` | 普通用户固定 mine；ADMIN 可 all |
| 恢复 | POST | `/api/trash/:nodeId/restore` | path | `ApiResult<Node>` | 原 parent 已删 → 回根 |
| 彻底删除 | DELETE | `/api/trash/:nodeId` | `?confirm=YES` | `ApiResult<void>` | 整棵子树 + 图片引用计数 |

定时任务：

```ts
@Cron('0 0 4 * * *')  // 每日 04:00
async purgeTick()      // deleted_at + 30d < now 的节点物理删除；image_refs 联动清理
```

##### Audit

| 接口 | 方法 | 路径 | 入参 | 出参 | 说明 |
|------|------|------|------|------|------|
| 查询日志 | GET | `/api/admin/audit` | `userId?, action?, from?, to?, page, size` | `ApiResult<Page<Audit>>` | 仅 ADMIN |

`AuditInterceptor` 在 controller 装饰器有 `@Audit('NODE_DELETE')` 时自动写日志：

```ts
@Delete(':id')
@RequirePermission('MANAGE')
@Audit('NODE_DELETE', 'NODE')
remove(@Param('id') id: number) { ... }
```

#### 错误处理策略

| 错误类型 | NestJS 异常类 | HTTP / Code |
|---------|-------------|-----------|
| SSO verify 失败 | `SsoVerifyException`（middleware 内捕获 → 302） | 302 → `/login-error?code=...` |
| 未登录 | `UnauthorizedException` | 401 |
| 权限不足 | `ForbiddenException` | 403 |
| 资源不存在 | `NotFoundException` | 404 |
| 参数非法 | `BadRequestException`（ZodValidationPipe 抛出） | 400 |
| 业务冲突 / 上限 | `ConflictException` | 409 |
| 恢复冲突（在线编辑） | `ConflictException` (data: `{ editorCount }`) | 409 |
| 协同上限 | Hocuspocus `onConnect` 抛 `Forbidden`，关闭 WS | WS close 4001 |
| 图片格式 / 大小 | `BadRequestException` | 400 |
| 未捕获异常 | `InternalServerErrorException` + pino.error | 500 |

`AppExceptionFilter`（位于 `CommonModule`）统一把上述异常转成 `ApiResult { code, message, data? }` 返回。

### 关键决策与理由

| 决策 | 可选方案 | 选择 | 理由 |
|------|---------|------|------|
| Runtime | Node 20 / Bun / Deno | **Node 20 LTS** | LTS + 生态最全；Bun/Deno 在企业内网监控生态尚不成熟 |
| 后端框架 | NestJS / Fastify / Hono | **NestJS 10** | 模块化+DI+Guard 与 Java 模块划分概念对齐；新团队不易飘 |
| 协同 | Hocuspocus / y-sweet / 自造 | **Hocuspocus** | Tiptap 官方维护；Database/Webhook/Auth 钩子开箱；新建项目首选 |
| 协同进程拓扑 | 独立 Node 子服务 / 嵌入 NestJS 同进程 | **嵌入同进程** | 单实例 ≤100 用户压力低；省去跨进程鉴权透传；docker-compose 仅一个 app 服务 |
| ORM | Drizzle / Prisma / TypeORM / Kysely | **Drizzle** | TS 类型推导最强、SQL-first、bundle 小；migration 显式可控 |
| 校验 | Zod / Joi / class-validator / TypeBox | **Zod** | 前后端共享 schema 的事实标准；`z.infer` 派生类型零样板 |
| 共享类型 | tsoa / OpenAPI generator / Zod monorepo | **Zod + pnpm workspace** | 不依赖代码生成；schema 即文档；改一处自动两端生效 |
| 编辑器 | Tiptap / Milkdown / Lexical | **Tiptap** | y-prosemirror 集成最成熟；扩展生态最广 |
| CRDT 算法 | yjs / Automerge | **yjs** | Tiptap 原生；浏览器性能更好；Hocuspocus 直接支持 |
| Session | iron-session / express-session+Redis store / JWT | **iron-session + Redis** | iron-session 加密 cookie 无需服务端查询；Redis 用于 logout 黑名单与 user 数据 mirror |
| PDF 生成 | Playwright / puppeteer / pdfkit / 客户端 print | **Playwright in worker_threads** | 渲染质量最好；worker_threads 隔离 CPU；puppeteer 同义但 Playwright 维护更活跃 |
| 文档树结构 | 邻接表 / 嵌套集合 / 物化路径 | **邻接表 + 物化路径冗余字段** | 邻接表 CRUD 简单；物化路径 O(1) 深度校验、子树查询 |
| 软删机制 | 全表 deleted_at / 独立 trash 表 | **deleted_at 字段** | 节点表自然挂回收站；恢复无需迁移行；级联便宜 |
| 数据库 | MySQL 8 / PostgreSQL 15 | **MySQL 8** | 企业内网普及；DBA 资源成熟；功能足够 |
| 文档内容存储 | 表内 longtext / 对象存储 | **表内 longtext** | 单文档 ≤1 MB 完全可控；事务一致；yjs_state 同表便于联事务 |
| WS 适配 | NestJS gateway / 独立 ws server / hocuspocus 独立 | **NestJS WsAdapter + Hocuspocus** | 复用 NestJS 生命周期、配置、日志；Hocuspocus 提供协议实现 |
| 图片存储 | 本地 FS / MinIO / DB BLOB | **本地 FS** | 局域网最简；备份策略走文件目录 |
| 日志 | pino / winston / bunyan | **pino** | 性能最高；NestJS pino 集成成熟 |
| 配置 | dotenv 裸用 / @nestjs/config | **@nestjs/config + Zod 校验** | 启动时 fail-fast；强类型 `AppConfig` |
| 部署 | Docker Compose / k8s / 裸进程 | **Docker Compose** | 局域网单机最快；MVP 不需要 k8s |

### 风险与权衡

> 触发条件命中：外部集成（SSO）+ 权限改动 + 高并发（WS + CRDT）+ 数据库变更（新建表）。

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 缺少项目级 Node 编码规范导致代码风格漂移 | 高 | 中 | 用户决定暂不编写 `BACKEND-NODE.md`；编码时依赖 TS strict + ESLint + Prettier 默认 + NestJS 官方约定；首次出现明显风格分歧时再补 |
| Playwright 启动 Chromium 资源占用 | 中 | 中 | worker pool 限 2 实例；冷启动时预热；空闲 5 分钟回收 |
| Hocuspocus onStoreDocument 写库节流不当导致 IO 风暴 | 中 | 中 | 配置 `debounce: 2000ms, maxDebounce: 10000ms`；MySQL 索引到位 |
| WS 断线丢失短暂编辑 | 低 | 低 | yjs 客户端本地存储 + 自动重连续传；Hocuspocus 服务端 yjs_state 持久化兜底 |
| 单文档并发上限被多 tab 绕过 | 低 | 低 | Redis Set 以 `(docId, userId)` 计数；同 userId 多连接共享名额 |
| clientSecret 泄露 | 低 | 高 | 仅通过环境变量注入；docker-compose `.env`（git ignore）；pino 自动脱敏字段配置 |
| SSO 服务超时拖累整体 | 中 | 高 | SsoVerifyClient 硬超时 5 秒；并发上限 20；登录失败页明确文案 |
| Node 单线程下 ZIP / sharp 阻塞事件循环 | 中 | 中 | 大文件（>5 MB zip / >2 MB 图片）走 `worker_threads`；流式处理 unzipper |
| Drizzle migration 在生产环境意外执行 | 低 | 高 | 启动时只跑 `migrate`（不跑 push）；CI 校验 `drizzle-kit check` 无冲突 |
| ADMIN 误删大量数据 | 中 | 高 | 所有写操作走 `AuditInterceptor`；彻底删除接口要求 `?confirm=YES` |
| 自动快照膨胀 | 低 | 中 | content_hash 跳过无变化；90 天清理；MANUAL 上限 100 |
| Node LTS 升级（30 个月一周期）维护成本 | 中 | 低 | Dockerfile 锁定大版本；每年至少演练一次 minor 升级 |

### 发布策略

新项目首次发布，无历史数据。

- **发布方式**：一次性（`docker compose up -d`）
- **回滚条件**：SSO 登录 / 创建文档 / 协同编辑 / 自动快照 / PDF 导出 任一在 30 分钟内连续失败 → 回退到上一镜像
- **数据迁移**：无；drizzle-kit 跑 0001_init.sql
- **预生产验证**：staging 跑通 27 项 acceptance 后再切

### 变更文件清单

> 全新项目，列工程目录骨架。

#### `apps/backend/`（NestJS）

```
apps/backend/
├── src/
│   ├── main.ts                          # bootstrap、middleware 注册、AppExceptionFilter、WsAdapter
│   ├── app.module.ts
│   ├── common/
│   │   ├── api-result.ts                # ApiResult<T> + ok() / fail()
│   │   ├── exceptions/{app.exception.ts, sso-verify.exception.ts}
│   │   ├── filters/app-exception.filter.ts
│   │   ├── pipes/zod-validation.pipe.ts
│   │   ├── decorators/{current-user.decorator.ts, audit.decorator.ts}
│   │   └── utils/{ids.ts, hashes.ts}
│   ├── config/
│   │   ├── config.module.ts
│   │   └── app-config.schema.ts         # Zod 校验 env
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── schema.ts                    # Drizzle table 定义
│   │   └── drizzle.client.ts
│   ├── redis/redis.module.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── sso-token.middleware.ts
│   │   ├── sso-verify.client.ts
│   │   ├── session.guard.ts             # 默认全局守卫
│   │   └── session.config.ts            # iron-session 配置
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── known-user.repo.ts
│   ├── node/
│   │   ├── node.module.ts
│   │   ├── node.controller.ts
│   │   ├── doc-content.controller.ts
│   │   ├── node.service.ts
│   │   ├── node.repo.ts
│   │   └── path-helper.ts
│   ├── permission/
│   │   ├── permission.module.ts
│   │   ├── permission.controller.ts
│   │   ├── permission.service.ts
│   │   ├── permission.repo.ts
│   │   ├── permission.guard.ts
│   │   └── require-permission.decorator.ts
│   ├── collab/
│   │   ├── collab.module.ts
│   │   ├── ws-adapter.ts                # 挂载 Hocuspocus 到 NestJS
│   │   ├── hocuspocus.factory.ts
│   │   ├── hooks/
│   │   │   ├── on-authenticate.hook.ts
│   │   │   ├── on-connect.hook.ts
│   │   │   ├── on-change.hook.ts
│   │   │   └── on-store-document.hook.ts
│   │   └── presence.service.ts          # Redis 在线编辑者集合
│   ├── snapshot/
│   │   ├── snapshot.module.ts
│   │   ├── snapshot.controller.ts
│   │   ├── snapshot.service.ts
│   │   ├── snapshot.repo.ts
│   │   └── jobs/{auto-snapshot.job.ts, cleanup.job.ts}
│   ├── image/
│   │   ├── image.module.ts
│   │   ├── image.controller.ts
│   │   ├── image.service.ts
│   │   ├── image.repo.ts
│   │   └── storage.ts
│   ├── imexport/
│   │   ├── imexport.module.ts
│   │   ├── import.controller.ts
│   │   ├── export.controller.ts
│   │   ├── markdown.service.ts
│   │   ├── zip.service.ts
│   │   ├── pdf.service.ts               # 提交任务到 worker pool
│   │   └── workers/pdf-worker.ts        # 独立 worker_threads 入口
│   ├── trash/
│   │   ├── trash.module.ts
│   │   ├── trash.controller.ts
│   │   ├── trash.service.ts
│   │   └── jobs/purge.job.ts
│   └── audit/
│       ├── audit.module.ts
│       ├── audit.controller.ts
│       ├── audit.service.ts
│       ├── audit.repo.ts
│       └── audit.interceptor.ts
├── drizzle/
│   ├── 0001_init.sql                    # drizzle-kit generate 出
│   └── meta/
├── test/                                # vitest e2e
├── drizzle.config.ts
├── nest-cli.json
├── tsconfig.json
├── package.json
└── Dockerfile
```

#### `apps/frontend/`（Vue 3）

```
apps/frontend/
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/index.ts
│   ├── stores/{currentUser.ts, currentDoc.ts, collabPresence.ts}
│   ├── api/
│   │   ├── http.ts                      # axios 实例 + 拦截器
│   │   ├── auth.api.ts
│   │   ├── user.api.ts
│   │   ├── node.api.ts
│   │   ├── permission.api.ts
│   │   ├── snapshot.api.ts
│   │   ├── image.api.ts
│   │   ├── imexport.api.ts
│   │   ├── trash.api.ts
│   │   └── ws.ts                        # yjs WebsocketProvider 工厂
│   ├── components/
│   │   ├── UserAvatar.vue
│   │   ├── DocTree/{DocTree.vue, NodeMenu.vue, NewNodeDialog.vue, MoveDialog.vue}
│   │   ├── Editor/
│   │   │   ├── EditorShell.vue
│   │   │   ├── Toolbar.vue
│   │   │   ├── extensions/{Mermaid.ts, Math.ts, Image.ts, YjsBinding.ts}
│   │   │   └── PresenceBar.vue
│   │   ├── SharePanel/{SharePanel.vue, UserSearchBox.vue, RoleSelect.vue}
│   │   ├── VersionPanel/{VersionPanel.vue, VersionItem.vue, RestoreConfirm.vue}
│   │   └── TrashPanel/TrashPanel.vue
│   ├── views/{EditorView.vue, TrashView.vue, LoginErrorView.vue}
│   └── styles/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

#### `packages/shared/`

```
packages/shared/
├── src/
│   ├── schemas/
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   ├── node.ts
│   │   ├── permission.ts
│   │   ├── snapshot.ts
│   │   ├── image.ts
│   │   ├── imexport.ts
│   │   ├── trash.ts
│   │   └── audit.ts
│   ├── types/
│   │   ├── api-result.ts
│   │   └── role.ts
│   └── index.ts
├── tsconfig.json
└── package.json
```

#### 根

```
├── .env.example
├── docker-compose.yml
├── docker/nginx.conf
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json
└── README.md
```

## How

### 任务拆分

**任务排序**：先规范 → 脚手架 → 鉴权 → 数据基础 → 业务 → 收尾 → 联调。

| 任务名称 | 详细描述 | 关联设计章节 | 计划工作量(人天) |
|----------|---------|------------|--------------|
| 【基建】(全栈) monorepo 脚手架 | 1. pnpm workspaces<br>2. apps/backend NestJS 初始化<br>3. apps/frontend Vue 3 + Vite + Pinia<br>4. packages/shared + tsconfig path<br>5. AppExceptionFilter、ApiResult、ZodValidationPipe、CurrentUser 装饰器<br>6. pino logger 接入<br>7. @nestjs/config + Zod 校验 env | 架构决策 | 1 |
| 【基建】(全栈) Drizzle + 迁移 | 1. drizzle schema 定义全部 7 张表<br>2. drizzle.config.ts<br>3. 0001_init.sql 生成<br>4. DatabaseModule provider | 数据模型 | 0.5 |
| 【基建】(运维) Docker Compose + Nginx | 1. compose: MySQL + Redis + app + Nginx<br>2. Nginx 反代静态 + `/api/*` + `/ws/*`（含 WS upgrade）<br>3. .env.example<br>4. README 部署说明 | 架构决策 | 0.5 |
| 【SSO】(后端) ssoToken 验证与会话 | 1. SsoTokenMiddleware：URL 拦截、调 verify、错误分类、302 去参数<br>2. SsoVerifyClient（5s 超时）<br>3. iron-session 配置 + Redis 数据 mirror<br>4. AuthController：`/api/auth/me`、`/api/auth/logout`<br>5. SessionGuard 全局守卫 | 接口定义 Auth | 1 |
| 【SSO】(后端) known_users 表 + 检索 | 1. KnownUserService.upsert（每次登录写入/更新）<br>2. `/api/users/search`（LIKE）<br>3. `/api/users/by-username/:name` | 数据模型 / 接口定义 User | 0.5 |
| 【SSO】(前端) 登录守卫与会话保持 | 1. router beforeEach：`/api/auth/me` 失败 → 等待重定向 / LoginErrorView<br>2. 顶栏 UserAvatar + 登出<br>3. LoginErrorView 文案根据 ?code 切换 | 接口定义 Auth | 0.5 |
| 【头像】(前端) UserAvatar 组件 | 1. 文字规则（中文 1/2/≥3 / 英文首字母 / 空）<br>2. user_id → 16 色稳定哈希<br>3. props: { userId, name, size, shape }<br>4. 全站统一使用 | — | 0.5 |
| 【文档树】(后端) Node CRUD | 1. NodeRepo（drizzle 查询封装）<br>2. NodePathHelper 路径构建、子树重写<br>3. Controller + Service：tree / detail / create / patch / delete<br>4. 校验：深度/同级唯一/命名字符（Zod）<br>5. 软删级联（path 前缀） | 数据模型 / 接口定义 Node | 1 |
| 【文档树】(前端) 树组件 | 1. DocTree.vue：展开/折叠/虚拟滚动<br>2. 右键菜单（新建文档/新建文件夹/重命名/移动/删除）<br>3. 拖拽移动<br>4. 新建/重命名对话框 + Zod 校验提示 | 接口定义 Node | 1.5 |
| 【权限】(后端) 文档权限 + ADMIN 旁路 | 1. PermissionRepo<br>2. `@RequirePermission` + PermissionGuard（含 ADMIN 旁路）<br>3. 文件夹仅校验自身 READ 不向下继承<br>4. 分享接口 GET / PUT / DELETE | 数据模型 / 接口定义 Permission | 1 |
| 【权限】(前端) 分享面板 | 1. SharePanel.vue：协作者列表 + 角色切换 + 移除<br>2. UserSearchBox：模糊检索 + 精确匹配<br>3. 未登录用户提示<br>4. 仅 MANAGE/ADMIN 入口可见 | 接口定义 Permission / User | 1 |
| 【管理员】(后端) 审计 + 全局回收站 | 1. AuditService + AuditInterceptor + `@Audit` 装饰器<br>2. operation_log 表 repo<br>3. `/api/admin/audit` 查询接口<br>4. `/api/trash?scope=all` 全局回收站 | 数据模型 / 接口定义 Audit | 0.5 |
| 【管理员】(前端) 全局回收站视图 | 1. ADMIN 切 mine/all<br>2. 列操作人列 | 接口定义 Trash / Audit | 0.5 |
| 【编辑器】(前端) Tiptap 富 MD 渲染 | 1. Tiptap StarterKit + Table + CodeBlock(highlight) + Image + Math + Mermaid 扩展<br>2. Toolbar + 快捷键<br>3. MD ⇄ ProseMirror schema（remark 桥接） | — | 2 |
| 【协同】(后端) Hocuspocus 接入 | 1. ws-adapter 挂载到 NestJS<br>2. onAuthenticate：从 cookie 取 session、查 user<br>3. onConnect：权限校验 + Redis 编辑者上限校验 + readOnly 标记<br>4. onStoreDocument：写 nodes.yjs_state / current_content / content_updated_at<br>5. PresenceService（Redis Set） | 接口定义 Collab | 1.5 |
| 【协同】(前端) yjs + 光标同步 | 1. WebsocketProvider 连 `/ws/docs/:id`（带 cookie）<br>2. y-prosemirror 绑定 Tiptap<br>3. awareness 渲染远程光标 + 姓名标签（用 UserAvatar）<br>4. 在线协作者头像列表<br>5. 断线重连提示 + 3 次失败转只读 | 接口定义 Collab | 1.5 |
| 【图片】(后端) 上传 + 引用计数 | 1. multipart 接收 + 校验<br>2. 本地存储 yyyy/MM/dd/{uuid}.{ext}<br>3. images + image_refs 表<br>4. `/api/images/:token` 读取 | 数据模型 / 接口定义 Image | 0.5 |
| 【图片】(前端) 粘贴/拖拽上传 | 1. Tiptap Image 扩展接管粘贴/拖拽<br>2. 进度提示 + 失败重试<br>3. 客户端预校验 | 接口定义 Image | 0.5 |
| 【版本】(后端) 快照生成与恢复 | 1. snapshots 表 repo<br>2. 手动快照接口（≤100 校验）<br>3. AutoSnapshotJob（每分钟扫近期变更 doc，content_hash 比对建 AUTO）<br>4. 列表/详情/恢复接口<br>5. 恢复时 editorCount>0 && !force → 409<br>6. 恢复通过 Hocuspocus 替换 ytext 内容自动广播<br>7. CleanupJob（每日清 expires 的 AUTO） | 数据模型 / 接口定义 Snapshot | 1.5 |
| 【版本】(前端) 版本面板 | 1. 时间线 UI（AUTO/MANUAL/RESTORE 标记）<br>2. 内容预览<br>3. 命名手动快照对话框<br>4. 恢复确认（含"覆盖 N 人编辑"提示） | 接口定义 Snapshot | 1.5 |
| 【导入导出】(后端) | 1. md 导入：校验后建 doc<br>2. zip 导入：unzipper 流式解包 → 全量校验 → 还原目录树<br>3. md 导出：current_content 流<br>4. PDF 导出：Playwright worker pool（最大 2 实例），渲染含 Mermaid/Math 完整文档；接收 docId，自取内容<br>5. ImportResult 列出成功/失败 | 接口定义 Import/Export | 1.5 |
| 【导入导出】(前端) | 1. 导入对话框（md / zip）<br>2. 导出菜单（md / pdf 都直接走后端流）<br>3. 导入结果展示 | 接口定义 Import/Export | 0.5 |
| 【回收站】(后端) | 1. `/api/trash`（mine/all）<br>2. 恢复（原 parent 已删 → 回根）<br>3. 彻底删除（confirm=YES）<br>4. 30 天清理任务（含图片引用减计） | 接口定义 Trash | 0.5 |
| 【回收站】(前端) | 1. TrashView 列表 + 操作<br>2. ADMIN 切换 | 接口定义 Trash | 0.5 |
| 【联调】端到端联调与功能测试 | 1. SSO → 创建 → 编辑 → 分享 → 协同 全链路<br>2. 多浏览器实测 10 人协同 + 第 11 人只读<br>3. 权限矩阵 + ADMIN 旁路<br>4. 版本恢复（在线/离线）<br>5. 导入导出（md/zip/pdf）+ 边界<br>6. 图片上传与回收清理<br>7. 回收站 30 天逻辑（SQL 时间穿越）<br>8. 异常路径（SSO 失效、WS 断网、超限文件） | — | 2 |
| **合计** | | | **22.5** |

**任务依赖**：

```
- 基建 monorepo / Drizzle / Compose      ← 一切前置
- SSO 后端验证 + known_users             ← 所有 API 的鉴权前置
- SSO 前端守卫 + 头像                    ← UI 前置
- 文档树后端                              ← 协同 / 权限 / 快照
- 文档树前端                              ← 编辑器 / 分享入口
- 权限后端                                ← 协同 / 分享 / 版本 / 导入导出 / 回收 / 管理员
- 权限前端 + 管理员前端                   ← UI 收尾
- 编辑器前端                              ← 协同前端 / 图片前端 / 导入导出前端
- 协同后端 (Hocuspocus)                   ← 协同前端 / 版本恢复广播
- 版本后端                                ← 版本前端
- 图片后端                                ← 图片前端 / 导入导出 / 回收清理
- 导入导出后端                            ← 导入导出前端
- 回收站后端                              ← 回收站前端 / 管理员回收站
- 联调                                    ← 所有上面任务
```

## Verify

```
设计自检：
- [x] 所有 spec 功能需求都有对应的技术方案（F1~F19 全覆盖）
- [x] 所有技术决策都有理由（19 项决策表 + 12 项风险）
- [x] 接口定义完整（入参/出参/异常；REST + Hocuspocus 协议）
- [x] 数据模型变更明确（7 张新表 + nodes 增加 yjs_state 字段）
- [x] 任务拆分覆盖全部设计内容（24 个任务）
- [x] 任务总量与需求规模匹配（22.5 人天，对比第一版 27 人天降 4.5 天，源于 Hocuspocus 节省协同实现 / Drizzle 节省 DAO / 共享 Zod 节省对接联调）
- [x] 无实现代码（只有签名和结构）
- [x] 已按触发条件生成 Risks/Rollout（外部集成 + 权限 + 高并发 + DB 变更四项全中）
```

## Impact

- **新建工程**：monorepo（apps/backend、apps/frontend、packages/shared）+ docker-compose 套件
- **数据库**：新建 7 张表 + nodes 新增 `yjs_state` 字段；drizzle-kit 0001_init.sql 一次性生成
- **外部依赖**：MySQL 8、Redis 7、Nginx 1.24+、三方 SSO 仅 `/api/sso/verify`
- **运行时**：单 Node 20 进程承载 HTTP + WS + 定时任务 + PDF Worker Pool；本地文件目录（图片）
- **配置**：`SSO_BASE_URL` / `SSO_CLIENT_ID` / `SSO_CLIENT_SECRET` / `SSO_LOGOUT_REDIRECT` / `MYSQL_*` / `REDIS_*` / `SESSION_PASSWORD`（iron-session 加密密钥，≥32 字符）/ `UPLOAD_DIR` 通过环境变量注入
- **规范文档**：暂不单独编写 `BACKEND-NODE.md`；coding 阶段依赖 NestJS 官方约定 + TS strict + ESLint/Prettier 默认；若团队出现明显风格分歧再补
