# ─────────────────────────────────────────────────────────────────
# md-collab 前端镜像（构建 + Nginx serve）
# by AI.Coding
#
# 两阶段：
#   1) node:20 装 pnpm → 构建 packages/shared + apps/frontend
#   2) nginx:alpine 装上 dist + 项目自带的 nginx.conf
# 部署时直接 build 一次产出最终镜像，host 无需预先 pnpm build。
# ─────────────────────────────────────────────────────────────────

# Stage 1: 构建静态资源
FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# 先复制 workspace 元数据最大化 layer cache
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# 源码
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend

# shared 必须先 build，frontend 才能 import @app/shared
RUN pnpm --filter @app/shared build
RUN pnpm --filter @app/frontend build

# ─────────────────────────────────────────────────────────────────
# Stage 2: Nginx 服务
FROM nginx:1.27-alpine AS runner

# 替换默认 conf
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /workspace/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
