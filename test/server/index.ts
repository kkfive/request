import type { IncomingMessage, Server } from 'node:http'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

let server: Server | null = null
let serverPort: number = 0

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => resolve(body))
  })
}

function parseFormData(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString()
      const contentType = req.headers['content-type'] || ''
      const result: Record<string, string> = {}

      if (contentType.includes('multipart/form-data')) {
        const boundaryMatch = contentType.match(/boundary=(.+)/)
        if (boundaryMatch) {
          const boundary = boundaryMatch[1]
          const parts = body.split(`--${boundary}`).filter(p => p.trim() && !p.includes('--'))
          for (const part of parts) {
            const nameMatch = part.match(/name="([^"]+)"/)
            if (nameMatch) {
              const name = nameMatch[1]
              const valueMatch = part.split('\r\n\r\n')[1]
              if (valueMatch) {
                result[name] = valueMatch.replace(/\r\n$/, '')
              }
            }
          }
        }
      }
      resolve(result)
    })
  })
}

export function startServer(): Promise<string> {
  return new Promise((resolve) => {
    server = createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost`)
      const method = req.method || 'GET'

      // 设置 CORS 和 JSON 响应头
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Custom-Header')

      // 处理 OPTIONS 预检请求
      if (method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
      }

      // 路由处理
      if (url.pathname === '/success') {
        res.statusCode = 200
        res.end(JSON.stringify({
          success: true,
          data: Math.random().toString(36).substring(7),
        }))
      }
      else if (url.pathname === '/echo') {
        const body = await parseBody(req)
        let parsedBody: unknown = null
        try {
          parsedBody = JSON.parse(body)
        }
        catch {
          parsedBody = body || null
        }
        res.statusCode = 200
        res.end(JSON.stringify({
          success: true,
          data: {
            method,
            body: parsedBody,
            query: Object.fromEntries(url.searchParams),
          },
        }))
      }
      else if (url.pathname === '/params') {
        res.statusCode = 200
        res.end(JSON.stringify({
          success: true,
          data: {
            query: Object.fromEntries(url.searchParams),
            rawQuery: url.search,
          },
        }))
      }
      else if (url.pathname === '/auth/check') {
        const authorization = req.headers.authorization || null
        res.statusCode = 200
        res.end(JSON.stringify({
          success: true,
          data: { authorization },
        }))
      }
      else if (url.pathname === '/headers/check') {
        res.statusCode = 200
        res.end(JSON.stringify({
          success: true,
          data: { headers: req.headers },
        }))
      }
      else if (url.pathname === '/formdata') {
        const formData = await parseFormData(req)
        const contentType = req.headers['content-type'] || ''
        res.statusCode = 200
        res.end(JSON.stringify({
          success: true,
          data: {
            fields: formData,
            contentType,
            isMultipart: contentType.includes('multipart/form-data'),
          },
        }))
      }
      else if (url.pathname === '/timeout') {
        await new Promise(r => setTimeout(r, 5000))
        res.statusCode = 200
        res.end(JSON.stringify({ success: true, data: 'delayed' }))
      }
      else if (url.pathname === '/custom-code') {
        res.statusCode = 200
        res.end(JSON.stringify({
          code: 0,
          data: 'custom code response',
          msg: 'success',
        }))
      }
      else if (url.pathname === '/custom-message') {
        res.statusCode = 200
        res.end(JSON.stringify({
          success: false,
          msg: '自定义错误消息',
          errorCode: 1001,
        }))
      }
      else if (url.pathname === '/error/business/500') {
        res.statusCode = 200
        res.end(JSON.stringify({
          success: false,
          errorCode: 500,
          errorMessage: '业务错误',
        }))
      }
      else if (url.pathname === '/error/http/400') {
        res.statusCode = 400
        res.end(JSON.stringify({ message: '请求参数错误' }))
      }
      else if (url.pathname === '/error/http/401') {
        res.statusCode = 401
        res.end(JSON.stringify({ message: '未授权或登录已过期' }))
      }
      else if (url.pathname === '/auth/protected') {
        // 模拟需要 token 的受保护端点（回显 body 以便验证重试时 body 是否保留）
        const authorization = req.headers.authorization || ''
        const rawBody = await parseBody(req)
        let received: unknown = null
        try {
          received = rawBody ? JSON.parse(rawBody) : null
        }
        catch {
          received = rawBody || null
        }
        if (authorization.includes('new-token')) {
          // 刷新后的新 token，返回成功（仅在有 body 时回显 received，避免影响无 body 的断言）
          res.statusCode = 200
          const data: Record<string, unknown> = { id: 1, name: 'user' }
          if (received != null) {
            data.received = received
          }
          res.end(JSON.stringify({ code: 0, success: true, data }))
        }
        else {
          // 旧 token 或无 token，返回 401
          res.statusCode = 401
          res.end(JSON.stringify({ message: '未授权或登录已过期' }))
        }
      }
      else if (url.pathname === '/always-401') {
        // 总是返回 401，用于测试无限重试防护
        res.statusCode = 401
        res.end(JSON.stringify({ message: '未授权' }))
      }
      else if (url.pathname === '/error/http/403') {
        res.statusCode = 403
        res.end(JSON.stringify({ message: '没有权限访问该资源' }))
      }
      else if (url.pathname === '/error/http/404') {
        res.statusCode = 404
        res.end(JSON.stringify({ message: '请求的资源不存在' }))
      }
      else if (url.pathname === '/error/http/500') {
        res.statusCode = 500
        res.end(JSON.stringify({ message: '服务器内部错误' }))
      }
      else if (url.pathname === '/error/http/418') {
        res.statusCode = 418
        res.end(JSON.stringify({ message: 'I\'m a teapot' }))
      }

      // SSE 端点
      else if (url.pathname === '/sse/chat') {
        const body = await parseBody(req)
        let parsed: any = {}
        try {
          parsed = JSON.parse(body)
        }
        catch {}

        const chunks = (url.searchParams.has('echoRequest') || parsed.echoRequest)
          ? [{ method, body: body ? parsed : null }]
          : parsed.chunks || [
            { choices: [{ delta: { content: 'Hello' } }] },
            { choices: [{ delta: { content: ' world' } }] },
            { choices: [{ delta: { content: '!' } }] },
          ]

        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.statusCode = 200

        for (const chunk of chunks) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`)
        }
        res.write('data: [DONE]\n\n')
        res.end()
      }
      else if (url.pathname === '/sse/generic') {
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.statusCode = 200

        res.write(`event: custom\ndata: first event\nid: 1\n\n`)
        res.write(`data: second event\nid: 2\nretry: 3000\n\n`)
        res.write(`event: special\ndata: {"key":"value"}\nid: 3\n\n`)
        res.end()
      }
      else if (url.pathname === '/sse/headers') {
        const authorization = req.headers.authorization || null
        const customHeader = req.headers['x-custom'] || null

        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.statusCode = 200

        res.write(`data: ${JSON.stringify({ authorization, customHeader })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
      else if (url.pathname === '/sse/protected') {
        const authorization = req.headers.authorization || ''
        if (!authorization.includes('new-token')) {
          res.statusCode = 401
          res.end(JSON.stringify({ message: '未授权或登录已过期' }))
          return
        }

        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.statusCode = 200

        res.write(`data: ${JSON.stringify({ authorization, status: 'ok' })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
      else if (url.pathname === '/sse/error') {
        res.statusCode = 500
        res.end(JSON.stringify({ message: 'Internal Server Error' }))
      }
      else {
        res.statusCode = 404
        res.end(JSON.stringify({ message: 'Not Found' }))
      }
    })

    server.listen(0, () => {
      const address = server!.address()
      serverPort = typeof address === 'object' ? address!.port : 0
      resolve(`http://localhost:${serverPort}`)
    })
  })
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve())
    }
    else {
      resolve()
    }
  })
}
