# ─────────────────────────────────────────────────────────────────
# md-collab 后端镜像（多阶段构建）
# by AI.Coding
# ─────────────────────────────────────────────────────────────────

# Stage 1: 构建
FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

# 启用 pnpm
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# 复制 workspace 元数据，先单独 install 以最大化 cache
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# 复制源码并构建
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

RUN pnpm --filter @app/shared build
RUN pnpm --filter @app/backend build

# 仅保留生产依赖到 deploy 目录
RUN pnpm deploy --filter @app/backend --prod /deploy

# ─────────────────────────────────────────────────────────────────
# Stage 2: 运行时
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Playwright 运行所需的系统依赖（Chromium 由 npx playwright install 拉取）
# 字体：noto-cjk 用于中文 PDF 渲染
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-noto-cjk \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

# 拷贝构建产物 + 生产依赖
COPY --from=builder /deploy ./
COPY --from=builder /workspace/apps/backend/drizzle ./drizzle

# 安装 Chromium（不带 --with-deps，因为系统依赖已经在上一层装好）
RUN node ./node_modules/playwright/cli.js install chromium

EXPOSE 3000
CMD ["node", "dist/main.js"]
