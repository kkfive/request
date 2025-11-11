/**
 * Mock HTTP Server for testing
 * 用于测试的本地 HTTP 模拟服务器
 */

import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { mockRoutes } from './handlers'

export class MockHttpServer {
  private server: Server | null = null
  private port: number = 0

  /**
   * 启动 mock 服务器
   */
  async start(port: number = 0): Promise<string> {
    this.port = port

    return new Promise((resolve, reject) => {
      this.server = createServer(this.handleRequest.bind(this))

      this.server.on('error', (error) => {
        reject(error)
      })

      this.server.listen(port, '127.0.0.1', () => {
        const address = this.server!.address()
        const actualPort = typeof address === 'object' && address !== null ? address.port : port
        this.port = actualPort
        const baseUrl = `http://127.0.0.1:${actualPort}`
        // Mock server started
        resolve(baseUrl)
      })
    })
  }

  /**
   * 停止 mock 服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve()
        return
      }

      this.server.close((error) => {
        if (error) {
          reject(error)
        }
        else {
          // Mock server stopped
          this.server = null
          resolve()
        }
      })
    })
  }

  /**
   * 处理请求
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url || '/'

    // 查找匹配的 mock 路由
    const mockRoute = mockRoutes[url]

    if (!mockRoute) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `No mock route found for: ${url}` }))
      return
    }

    // 设置响应头
    const headers = mockRoute.headers || { 'Content-Type': 'application/json' }
    res.writeHead(mockRoute.status, headers)

    // 返回响应体
    res.end(JSON.stringify(mockRoute.body))
  }
}

// 导出单例实例
export const mockServer = new MockHttpServer()
