# md-collab — 在线多人协作 Markdown 编辑器

B/S 架构、局域网部署的实时协同 Markdown 编辑器。

## 技术栈

- **后端**：Node 20 + TypeScript + NestJS 10 + Drizzle ORM + Hocuspocus（嵌入 NestJS）+ Playwright（PDF）
- **前端**：Vue 3 + TypeScript + Vite + Pinia + Tiptap + yjs + y-prosemirror
- **共享**：`packages/shared` 放 Zod schema，被前后端通过 `@app/shared` 直接引用
- **存储**：MySQL 8 + Redis 7 + 本地文件
- **部署**：Docker Compose

详见 `changes/active/md-collab-mvp/design.md`。

## 仓库结构

```
md-collab/
├── apps/
│   ├── backend/        # NestJS + Hocuspocus
│   └── frontend/       # Vue 3
├── packages/
│   └── shared/         # 前后端共享的 Zod schema 与 TS 类型
├── docker/             # nginx 配置
├── docker-compose.yml
└── .env.example
```

## 快速开始（本机开发）

> 假设本机已安装 Node 20+、pnpm 9+、Docker。

```bash
# 1. 安装依赖
pnpm install

# 2. 编译共享包（前后端依赖它的 dist）
pnpm build:shared

# 3. 复制环境变量
cp .env.example .env
# 编辑 .env，至少改 SESSION_PASSWORD 和 SSO_CLIENT_SECRET

# 4. 启动 MySQL + Redis（前台容器）
docker compose up -d mysql redis

# 5. 跑数据库迁移
pnpm db:migrate

# 6. 启动后端（开发模式，监听 3000）
pnpm dev:backend

# 7. 另开终端，启动前端（Vite，监听 5173）
pnpm dev:frontend
```

健康检查：`curl http://localhost:3000/api/health`

## 部署（生产）

```bash
cp .env.example .env
# 修改 .env：所有密码、SSO 配置、SESSION_PASSWORD

docker compose up -d
# Nginx 反代后浏览器访问 http://<host>/
```

## 数据库迁移

```bash
# 生成新迁移（修改了 schema.ts 后）
pnpm db:generate

# 应用迁移到数据库
pnpm db:migrate
```

## 开发文档

- `changes/active/md-collab-mvp/spec.md` — 功能规格（含 Delta）
- `changes/active/md-collab-mvp/design.md` — 技术设计
- `changes/active/md-collab-mvp/tasks.md` — 实施任务追踪
