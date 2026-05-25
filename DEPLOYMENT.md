# md-collab 部署手册

> 目标：Rocky Linux 9 / RHEL 9 / CentOS Stream 9（dnf 系列）
> 部署形态：Docker Compose
> 反代：Nginx（容器内）→ Node 后端

## 0. 前置

- 服务器 4C/8G、≥ 20GB 磁盘
- 内网可访问 SSO 服务端
- 已有可解析的内网域名或 IP（如 `http://docs.intranet.local`）

## 1. 服务器初始化

```bash
# 用 root 或加 sudo
dnf install -y dnf-utils device-mapper-persistent-data lvm2 git
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
docker version
docker compose version
```

如果服务器开了 SELinux（默认开），上传卷挂载没问题（compose 用 named volume），不需要额外打 context。

防火墙放行 80（或你改的 HTTP_PORT）：

```bash
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --reload
```

## 2. 拉代码 / 准备目录

```bash
mkdir -p /opt/md-collab && cd /opt/md-collab
# 用 git 拉，或者把 tar 包传上来解压
git clone <repo-url> .
# 或：scp -r your-pc:/path/to/md-collab/* /opt/md-collab/
```

## 3. 准备 `.env`

```bash
cp .env.example .env

# 生成强随机 SESSION_PASSWORD
echo "SESSION_PASSWORD=$(openssl rand -hex 32)" >> .env.tmp

# 编辑以下必改项：
#   MYSQL_PASSWORD       强密码
#   SESSION_PASSWORD     用上面 openssl 生成
#   SSO_BASE_URL         真实 SSO 地址
#   SSO_CLIENT_ID        SSO 申请的 client id
#   SSO_CLIENT_SECRET    SSO 申请的 client secret
#   SSO_LOGOUT_REDIRECT  登出跳转地址
vi .env
```

## 4. 首次启动

部署形态有两种，**通过 `.env` 里的 `COMPOSE_PROFILES` 切换**：

### 形态 A：连接已有的外部 MySQL / Redis（推荐生产环境）

`.env`：

```
COMPOSE_PROFILES=
DATABASE_URL=mysql://mdcollab:S3cret@10.0.0.5:3306/md_collab
REDIS_HOST=10.0.0.6
REDIS_PORT=6379
REDIS_PASSWORD=xxxxxx
# MYSQL_* 三项可以保留不写
```

外部 MySQL 需要预先建好 database 与用户：

```sql
CREATE DATABASE md_collab DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'mdcollab'@'%' IDENTIFIED BY 'S3cret';
GRANT ALL PRIVILEGES ON md_collab.* TO 'mdcollab'@'%';
FLUSH PRIVILEGES;
```

### 形态 B：一体化部署（顺带起 MySQL + Redis 容器）

适合：没有现成的 MySQL/Redis、测试环境、PoC。

`.env`：

```
COMPOSE_PROFILES=bundled-db
DATABASE_URL=mysql://mdcollab:please-change-me@mysql:3306/md_collab
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# 必填，初始化 mysql 容器（user/pwd/db 必须与 DATABASE_URL 一致）
MYSQL_USER=mdcollab
MYSQL_PASSWORD=please-change-me
MYSQL_DATABASE=md_collab
```

### 通用启动命令

形态 A / B 都是同一条命令，区别只在 `.env`：

```bash
docker compose build
docker compose up -d
```

> 原理：compose v2 读取 `.env` 里 `COMPOSE_PROFILES` 决定哪些服务参与编排。
> `mysql` / `redis` 服务在 docker-compose.yml 里挂了 `profiles: [bundled-db]`，
> profile 没激活就直接不参与；同时 `app` / `migrate` 中 depends_on 指向它们
> 的条目会被 compose 自动忽略，启动顺序自然适配两种形态。

### 观察启动状态

```bash
docker compose ps
# 形态 A 期望：app / web running；migrate exited (0)
# 形态 B 还会看到 mysql / redis healthy
docker compose logs -f app
docker compose logs -f web
```

健康检查：

```bash
curl http://localhost/api/health
# 应返回 { "code": 0, "message": "ok", "data": { "status": "up" } }
```

浏览器访问 `http://<服务器 IP>/`，从 SSO 入口带 `?ssoToken=...` 进来登录。

## 5. 数据迁移 / 升级版本

代码更新后：

```bash
cd /opt/md-collab
git pull            # 或者重新 scp
docker compose build       # 重新构建受影响镜像
docker compose up -d       # 滚动重启
```

形态 A / B 都是这一组命令；compose 自动读 `.env` 里的 `COMPOSE_PROFILES` 决定要不要带 mysql/redis 一起。

- `migrate` 服务每次 up 都会跑一次；drizzle-kit 看到没有新迁移文件就是空跑（exit 0）
- 业务热数据放在 named volume，重启不丢
- 升级失败回滚：`git checkout <prev-commit>` → 重新 build + up

## 6. 持久化与备份

数据落在 Docker named volume：

| 卷 | 内容 | 形态 |
| --- | --- | --- |
| `md-collab_upload-data` | 上传图片（按日期分目录的二进制文件） | A / B 都有 |
| `md-collab_mysql-data` | MySQL 数据库 | 仅 B（一体化） |
| `md-collab_redis-data` | Redis AOF | 仅 B（一体化） |

> 形态 A 下，MySQL / Redis 数据由外部服务自行负责备份；只需备份 `upload-data`。

定期备份示例（cron 每天 03:30）：

```bash
# /etc/cron.d/md-collab-backup
30 3 * * * root /usr/local/bin/md-collab-backup.sh
```

`/usr/local/bin/md-collab-backup.sh`：

```bash
#!/bin/bash
set -e
DATE=$(date +%F)
DEST=/var/backups/md-collab/$DATE
mkdir -p "$DEST"

# 1) MySQL：mysqldump 通过 mysql 容器
docker compose -f /opt/md-collab/docker-compose.yml exec -T mysql \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines "$MYSQL_DATABASE"' \
  | gzip > "$DEST/db.sql.gz"

# 2) 上传文件：tar 整个 volume
docker run --rm \
  -v md-collab_upload-data:/data:ro \
  -v "$DEST":/backup \
  busybox tar czf /backup/upload.tar.gz -C /data .

# 保留 14 天
find /var/backups/md-collab -maxdepth 1 -type d -mtime +14 -exec rm -rf {} \;
```

恢复：

```bash
# 数据库
gunzip < db.sql.gz | docker compose exec -T mysql \
  sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'

# 上传文件
docker run --rm \
  -v md-collab_upload-data:/data \
  -v $(pwd):/backup \
  busybox sh -c 'cd /data && tar xzf /backup/upload.tar.gz'
```

## 7. 排查清单

| 现象 | 排查 |
| --- | --- |
| `docker compose up` 卡在 migrate | `docker compose logs migrate` 看错误；常见 DB 连不上、字符集不匹配 |
| 浏览器 502 | `docker compose logs app` 看后端是否挂；`docker compose ps` 确认 app healthy |
| 上传图片失败 | 看 nginx `client_max_body_size`（已配 64m）和 app 端 MAX_IMAGE_SIZE_MB |
| PDF 导出 500 | `docker compose logs app | grep -i playwright`；最大可能是 Chromium 拉取失败，重新 `docker compose build app` |
| 协同断线 | 看 nginx 是否带 upgrade 头（`docker exec md-collab-web-1 cat /etc/nginx/nginx.conf` 验证）；`/ws/` 段必须有 `proxy_set_header Upgrade $http_upgrade` |
| 中文文件名乱码 | 后端日志 / DB 都已配 utf8mb4；如导出 zip 乱码需查 yauzl 与 bufferToUtf8 是否生效 |

实时查日志：

```bash
docker compose logs -f --tail=200 app
```

## 8. 调整 / 运维常用命令

```bash
# 只重启后端（前端 / 数据库不动）
docker compose restart app

# 改了 docker-compose.yml 或 .env
docker compose up -d

# 进容器排查
docker compose exec app sh
docker compose exec mysql mysql -uroot -p

# 清理无用镜像
docker image prune -f
```

## 9. 已知限制

- 部署模型为单实例：app 容器横向扩展需要 Redis adapter for Hocuspocus，本版本未做
- 仅局域网；HTTPS 需要在 nginx.conf 加 443 server 段 + 证书挂载
- Playwright Chromium 镜像层约 +300MB；不需要 PDF 可在 Dockerfile 注释掉 `playwright/cli.js install chromium` 那行重建
