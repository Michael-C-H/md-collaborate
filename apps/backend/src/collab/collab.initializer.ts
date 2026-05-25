/**
 * 协同初始化器
 * by AI.Coding
 *
 * 应用启动时把 Hocuspocus 挂到 NestJS 的 HTTP server 的 upgrade 事件，
 * 实现 NestJS REST + Hocuspocus WS 同进程同端口的部署。
 *
 * URL 约定：客户端连 `/ws/docs/:docId`（实际 docId 也作为 HocuspocusProvider 的 name 传递）。
 * 这里只接受路径前缀为 `/ws/` 的 upgrade，其余交给 NestJS（如普通 HTTP）。
 */
import { Injectable, OnModuleInit } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import type { Duplex } from 'node:stream'
import type { IncomingMessage, Server as HttpServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { HocuspocusFactory } from './hocuspocus.factory'

@Injectable()
export class CollabInitializer implements OnModuleInit {
  private wss: WebSocketServer | null = null

  constructor(
    private readonly factory: HocuspocusFactory,
    private readonly adapterHost: HttpAdapterHost,
    private readonly logger: Logger,
  ) {}

  onModuleInit(): void {
    const httpAdapter = this.adapterHost.httpAdapter
    if (!httpAdapter) {
      this.logger.warn('HttpAdapter 未就绪，跳过 Hocuspocus 绑定')
      return
    }
    const httpServer = httpAdapter.getHttpServer() as HttpServer
    const hocuspocus = this.factory.build()

    // noServer 模式：自己处理 upgrade，不抢全局 path
    this.wss = new WebSocketServer({ noServer: true })

    httpServer.on(
      'upgrade',
      (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = request.url ?? ''
        // 接管所有以 /ws 开头的升级请求（含 /ws、/ws/123、/ws?room=x 等形态）
        if (!url.startsWith('/ws')) {
          return
        }
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          // 把 ws 交给 Hocuspocus 处理；context 由 onAuthenticate 钩子返回
          hocuspocus.handleConnection(ws, request)
        })
      },
    )

    this.logger.log('Hocuspocus 已绑定 /ws* 升级路径')
  }
}
