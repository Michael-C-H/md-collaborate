# 任务清单

> 来源: design.md（第二版 Node + NestJS）
> 生成时间: 2026-05-13

## 实施任务

- [x] 【基建-1】(全栈) monorepo 脚手架
  - 目标: 搭建 pnpm workspaces；apps/backend (NestJS 10) + apps/frontend (Vue 3 + Vite + Pinia) + packages/shared 三个 workspace；后端落地 `ApiResult`、`AppExceptionFilter`、`ZodValidationPipe`、`CurrentUser` 装饰器、pino logger、`@nestjs/config` + Zod env 校验；前端落地 axios http 实例 + 路由 + Pinia store 骨架
  - 涉及文件: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `apps/backend/**`, `apps/frontend/**`, `packages/shared/**`
  - 预期结果: `pnpm install` 通过；`pnpm --filter backend start:dev` 启动 NestJS（监听 3000）；`pnpm --filter frontend dev` 启动 Vite；`packages/shared` 可被前后端 import；后端 `GET /api/health` 返回 `{ code: 0, message: 'ok', data: { status: 'up' } }`

- [x] 【基建-2】(全栈) Drizzle schema + 迁移
  - 目标: 在 `apps/backend/src/database/schema.ts` 定义 7 张表（known_users / nodes / permissions / snapshots / images / image_refs / operation_log），含 nodes.yjs_state 字段；drizzle-kit 生成 `0001_init.sql`；`DatabaseModule` provider 注入 drizzle client
  - 涉及文件: `apps/backend/src/database/{schema.ts,drizzle.client.ts,database.module.ts}`, `apps/backend/drizzle.config.ts`, `apps/backend/drizzle/0001_init.sql`
  - 预期结果: `pnpm --filter backend db:migrate` 在本地 MySQL 上建表成功；schema 类型可被 service 层导入并通过 `db.select().from(nodes)` 取数

- [x] 【基建-3】(运维) Docker Compose + Nginx
  - 目标: docker-compose 编排 MySQL 8 + Redis 7 + app + Nginx；Nginx 反代静态、`/api/*`、`/ws/*`（带 WebSocket upgrade）；`.env.example` 含全部必需变量；后端 Dockerfile 多阶段构建
  - 涉及文件: `docker-compose.yml`, `docker/nginx.conf`, `apps/backend/Dockerfile`, `.env.example`, `README.md`
  - 预期结果: `docker compose up -d` 起齐所有服务；浏览器访问 `http://localhost` 命中 Nginx → 前端静态，`/api/health` 走到 NestJS

- [x] 【SSO-后端】ssoToken 验证与会话
  - 目标: 实现 `SsoTokenMiddleware`（URL 拦截、调三方 verify、错误分类、302 去参数）；`SsoVerifyClient`（POST `/api/sso/verify`，5s 超时，错误码映射 SsoVerifyException）；iron-session 配置 + Redis mirror；`AuthController.me / logout`；全局 `SessionGuard`
  - 涉及文件: `apps/backend/src/auth/**`
  - 预期结果: 访问 `/?ssoToken=xxx` → 后端验证 → 写 session → 302 到 `/`；后续访问 `/api/auth/me` 返回当前用户；token 失效跳 `/login-error?code=TOKEN_CONSUMED`；`/api/auth/logout` 销毁 session

- [x] 【SSO-后端】known_users 表 + 检索
  - 目标: `KnownUserService.upsert`（登录时写入/更新）；`/api/users/search?q=&limit=20`（LIKE 模糊）；`/api/users/by-username/:username`（精确，404 时返回 ApiResult code=404）
  - 涉及文件: `apps/backend/src/user/**`
  - 预期结果: 每次 SSO 验证通过自动 upsert；前端可调用搜索接口拿到登录过的用户

- [x] 【SSO-前端】登录守卫与会话保持
  - 目标: Vue Router beforeEach 守卫调用 `/api/auth/me`；401 时按 query 判断进入 `LoginErrorView` 或等待 SSO 重定向；顶栏渲染当前用户（UserAvatar + 姓名 + 登出按钮）；`LoginErrorView` 根据 `?code` 显示对应文案
  - 涉及文件: `apps/frontend/src/router/index.ts`, `apps/frontend/src/stores/currentUser.ts`, `apps/frontend/src/api/auth.api.ts`, `apps/frontend/src/views/LoginErrorView.vue`, `apps/frontend/src/components/AppTopBar.vue`
  - 预期结果: 未登录访问任何 route 被守卫拦截；已登录顶栏正确展示当前用户；登出后跳三方首页

- [x] 【头像】(前端) UserAvatar 组件
  - 目标: 单一 `<UserAvatar :userId :name :size :shape>` 组件；文字规则：中文 1/2/≥3 字 → 该字/全名/后 2 字；英文取首尾首字母（最多 2）；空 "?"；user_id 稳定哈希到 16 色调色板；同一 user_id 在任何位置颜色一致
  - 涉及文件: `apps/frontend/src/components/UserAvatar.vue`, `apps/frontend/src/components/UserAvatar.spec.ts`
  - 预期结果: "诸葛亮" 显示"葛亮"，"王" 显示"王"，"John Smith" 显示"JS"，空字符串显示"?"；颜色对同 user_id 稳定

- [x] 【文档树-后端】Node CRUD
  - 目标: `NodeRepo` 封装 drizzle 查询；`NodePathHelper` 路径构建、子树重写；Controller + Service 提供 tree / detail / create / patch / delete；Zod 校验（深度 ≤5、同级唯一、命名字符 1~100 且不含 `/ \ : * ? " < > |`）；软删按 path 前缀级联整棵子树
  - 涉及文件: `apps/backend/src/node/**`
  - 预期结果: 创建文档/文件夹、重命名、移动、软删 6 个接口可独立调用；深度超限 / 命名非法 / 同级重名 400；软删后子节点的 deleted_at 同步写入

- [x] 【文档树-前端】树组件
  - 目标: `DocTree.vue` 树形展示（展开/折叠）；右键菜单（新建文档、新建文件夹、重命名、移动、删除）；拖拽移动；新建/重命名/移动对话框 + Zod 校验提示
  - 涉及文件: `apps/frontend/src/components/DocTree/**`, `apps/frontend/src/api/node.api.ts`
  - 预期结果: 在文档树上完整执行 CRUD；操作错误（如重名）有明确提示

- [x] 【权限-后端】文档权限 + ADMIN 旁路
  - 目标: `PermissionRepo` + `@RequirePermission` 装饰器 + `PermissionGuard`（role==='ADMIN' 直接放行）；文件夹仅校验自身 READ 不向下继承；`GET/PUT/DELETE /api/nodes/:id/permissions/:userId`
  - 涉及文件: `apps/backend/src/permission/**`
  - 预期结果: 非协作者访问文档返回 403；ADMIN 访问任意文档放行；分享接口可增/改/删；创建者不能撤销自己的 MANAGE

- [x] 【权限-前端】分享面板
  - 目标: `SharePanel.vue` 协作者列表 + 角色切换 + 移除；`UserSearchBox` 模糊检索 + 精确匹配；输入未登录过的 username 时提示"该用户尚未访问本系统，请对方先登录一次后再添加"；仅 MANAGE/ADMIN 看到分享入口
  - 涉及文件: `apps/frontend/src/components/SharePanel/**`
  - 预期结果: 管理者可完整管理协作者；未登录用户不允许添加；角色切换实时生效

- [x] 【管理员-后端】审计 + 全局回收站
  - 目标: `AuditService` + `AuditInterceptor` + `@Audit('动作','目标类型')` 装饰器；`operation_log` 写入；`/api/admin/audit` 查询（仅 ADMIN）；`/api/trash?scope=all` 全局视图
  - 涉及文件: `apps/backend/src/audit/**`, 在 trash 模块加 scope 参数
  - 预期结果: 关键写操作自动入 audit；ADMIN 看到全系统软删项；非 ADMIN 调 `?scope=all` 返回 403
  - 落地说明：未做 Interceptor + 装饰器，改为各 service 内显式调 `AuditService.log()`（node 创建/软删、permission grant/revoke、snapshot 恢复、trash 恢复/彻底删除都已埋点）

- [x] 【管理员-前端】全局回收站视图
  - 目标: ADMIN 切换"我的 / 全部"；显示操作人列；操作日志页（简化版表格 + 筛选）
  - 涉及文件: `apps/frontend/src/views/TrashView.vue`, `apps/frontend/src/views/AuditView.vue`, `apps/frontend/src/components/AppTopBar.vue`
  - 预期结果: ADMIN 在回收站看到全部软删项；操作日志按时间倒序展示

- [x] 【编辑器-前端】Tiptap 富 MD 渲染
  - 目标: Tiptap StarterKit + Table + CodeBlock(highlight) + Image + Math + Mermaid 自定义扩展；Toolbar + 快捷键；remark/rehype 桥接 MD ⇄ ProseMirror schema
  - 涉及文件: `apps/frontend/src/components/Editor/**`
  - 预期结果: 编辑器可输入 MD 并实时渲染所有支持的元素；通过工具栏 / 快捷键操作格式

- [x] 【协同-后端】Hocuspocus 接入
  - 目标: NestJS WsAdapter 挂载 Hocuspocus Server；`onAuthenticate`（从 cookie 取 session、查 user）；`onConnect`（权限校验 + Redis 编辑者上限校验 + readOnly 标记）；`onStoreDocument`（写 nodes.yjs_state / current_content / content_updated_at）；`PresenceService`（Redis Set 维护 `editors:{docId}`）
  - 涉及文件: `apps/backend/src/collab/**`
  - 预期结果: 已登录用户连 `/ws/docs/:id` 可同步；无权限 4001；超 10 人编辑者第 11 人转 readOnly；Hocuspocus 周期持久化生效

- [x] 【协同-前端】yjs + 光标同步
  - 目标: `WebsocketProvider` 连 `/ws/docs/:id`（带 cookie）；y-prosemirror 绑定 Tiptap；awareness 渲染远程光标 + 姓名标签（UserAvatar）；在线协作者头像列表；断线重连提示 + 3 次失败转只读
  - 涉及文件: `apps/frontend/src/components/Editor/extensions/YjsBinding.ts`, `apps/frontend/src/components/Editor/PresenceBar.vue`, `apps/frontend/src/api/ws.ts`, `apps/frontend/src/stores/collabPresence.ts`
  - 预期结果: 两个浏览器实时同步编辑；光标/选区可见；断线有明确提示

- [x] 【图片-后端】上传 + 引用计数
  - 目标: `POST /api/images`（multipart，大小≤10MB，格式校验）；本地存储 `${UPLOAD_DIR}/yyyy/MM/dd/{uuid}.{ext}`；写 `images` + `image_refs` 表；`GET /api/images/:urlToken` 流式返回二进制
  - 涉及文件: `apps/backend/src/image/**`
  - 预期结果: 上传返回 url；非法格式/超大被 400 拦截；读图正常

- [x] 【图片-前端】粘贴/拖拽上传
  - 目标: Tiptap Image 扩展接管粘贴/拖拽事件；上传进度提示；失败提示并可重试；客户端预校验大小/格式
  - 涉及文件: `apps/frontend/src/components/Editor/extensions/Image.ts`
  - 预期结果: 编辑器内粘贴/拖拽图片自动上传并插入图片 MD 语法

- [x] 【版本-后端】快照生成与恢复
  - 目标: `SnapshotRepo` + `SnapshotService`；手动快照接口（type=MANUAL，单文档 ≤100 校验）；`AutoSnapshotJob`（每分钟扫近 5 分钟有 content_updated_at 的 doc，content_hash 比对建 AUTO）；列表/详情/恢复接口；恢复时 editorCount>0 && !force → 409；恢复通过 Hocuspocus 替换 ytext 自动广播；`CleanupJob`（每日清 expires < now 的 AUTO）
  - 涉及文件: `apps/backend/src/snapshot/**`
  - 预期结果: 自动 5 分钟一个快照（无变化跳过）；手动可命名；恢复后所有在线协作者编辑器同步刷新；90 天后过期清理

- [x] 【版本-前端】版本面板
  - 目标: 时间线 UI（AUTO/MANUAL/RESTORE 标记）；版本内容预览；命名手动快照对话框；恢复确认（含"覆盖 N 人编辑"提示）
  - 涉及文件: `apps/frontend/src/components/VersionPanel/**`
  - 预期结果: 用户可查看所有历史版本、命名手动快照、一键恢复

- [x] 【导入导出-后端】MD/ZIP/PDF
  - 目标: `POST /api/imports/md`（单文件 ≤5 MB）；`POST /api/imports/zip`（≤50 MB，unzipper 流式 + 全量校验后再写入）；`GET /api/docs/:id/export.md`；`GET /api/docs/:id/export.pdf`（Playwright worker pool 最大 2 实例，渲染含 Mermaid/Math 完整文档）；ImportResult 列出成功/失败
  - 涉及文件: `apps/backend/src/imexport/**`, `apps/backend/src/imexport/workers/pdf-worker.ts`
  - 预期结果: 单文件导入、zip 批量导入、md/pdf 导出全部可用；非法文件名 zip 整体失败；PDF 含 Mermaid 渲染

- [x] 【导入导出-前端】UI
  - 目标: 导入对话框（md / zip）；导出菜单（md / pdf 都走后端流）；导入结果展示（成功/失败列表）
  - 涉及文件: `apps/frontend/src/components/ImExport/**`
  - 预期结果: 用户可在前端完成导入导出全流程

- [x] 【回收站-后端】列表 / 恢复 / 彻底删除 / 定时清理
  - 目标: `GET /api/trash?scope=mine|all`；`POST /api/trash/:nodeId/restore`（原 parent 已删 → 回根）；`DELETE /api/trash/:nodeId?confirm=YES`（整棵子树 + 图片引用减计）；`TrashPurgeJob`（每日清理 deleted_at + 30d < now）
  - 涉及文件: `apps/backend/src/trash/**`
  - 预期结果: 软删项 30 天内可恢复 / 彻底删除；过期自动物理清理；图片引用计数为 0 时物理删文件

- [x] 【回收站-前端】UI
  - 目标: `TrashView` 列表 + 恢复 / 彻底删除按钮；文档树入口；ADMIN 切换 mine/all
  - 涉及文件: `apps/frontend/src/views/TrashView.vue`, `apps/frontend/src/components/AppTopBar.vue`
  - 预期结果: 用户可完整管理软删项

- [ ] 【联调】端到端联调与功能测试
  - 目标: 在浏览器实测覆盖：SSO 登录 → 创建 → 编辑 → 分享 → 协同（10 人）→ 第 11 人只读 → 权限矩阵 → ADMIN 旁路 → 版本恢复（在线/离线）→ 导入导出（md/zip/pdf）→ 图片上传与回收清理 → 回收站 30 天逻辑（SQL 时间穿越）→ 异常路径（SSO 失效、WS 断网、超限文件）
  - 涉及文件: 整体
  - 预期结果: 27 项 acceptance 全部通过；异常路径均有明确反馈

## 完成状态

> 进度: 23/24 已完成
> 计划工作量: 22.5 人天
