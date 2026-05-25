/**
 * 应用入口
 * by AI.Coding
 *
 * 职责：
 *   1. 创建 NestJS 应用，启用 pino logger
 *   2. 注册 cookie-parser（iron-session 需要）
 *   3. 注册全局异常过滤器，把异常统一转为 ApiResult
 *   4. 全局前缀 /api（健康检查 /health 除外）
 *   5. 监听端口
 */
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { ConfigService } from '@nestjs/config'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { AppExceptionFilter } from './common/filters/app-exception.filter'
import type { AppConfig } from './config/app-config.schema'

async function bootstrap(): Promise<void> {
  // bufferLogs：在 nestjs-pino 接管前先缓冲启动日志，确保不丢失
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  const logger = app.get(Logger)
  app.useLogger(logger)

  // cookie 解析；iron-session 依赖 req.headers.cookie 读写会话
  app.use(cookieParser())

  // 统一异常出口（必须在所有路由注册前生效）
  app.useGlobalFilters(new AppExceptionFilter(logger))

  // 业务接口统一挂 /api 前缀；健康检查也走 /api/health，前端与监控共用同一条路径
  app.setGlobalPrefix('api')

  const config = app.get(ConfigService<AppConfig, true>)
  const port = config.get('APP_PORT', { infer: true })

  await app.listen(port)
  logger.log(`md-collab backend listening on :${port}`, 'Bootstrap')
}

bootstrap().catch((err) => {
  // 启动期异常无法走全局过滤器，直接打印并退出
  // eslint-disable-next-line no-console
  console.error('bootstrap failed', err)
  process.exit(1)
})
