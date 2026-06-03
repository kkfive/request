import { beforeAll, describe, expect, it } from 'vitest'
import { createClient, createSSEStream, createSSEStreamFromResponse, Request } from '../src'

declare global {
  // eslint-disable-next-line vars-on-top
  var __TEST_SERVER_URL__: string
}

describe('sse 流式请求', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = globalThis.__TEST_SERVER_URL__
  })

  describe('基本 SSE 功能', () => {
    it('应能通过 async iteration 消费事件', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(events).toHaveLength(3)
      expect(events[0].data.choices[0].delta.content).toBe('Hello')
      expect(events[1].data.choices[0].delta.content).toBe(' world')
      expect(events[2].data.choices[0].delta.content).toBe('!')
    })

    it('json 解析应在默认开启', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(typeof events[0].data).toBe('object')
      expect(events[0].data).toHaveProperty('choices')
    })

    it('parser=text 应保留原始字符串', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat', undefined, { parser: 'text' })

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(typeof events[0].data).toBe('string')
      expect(events[0].data).toContain('"choices"')
    })

    it('[DONE] 信号应正确终止流', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      const doneEvent = events.find(e => e.data === '[DONE]')
      expect(doneEvent).toBeUndefined()
    })

    it('done promise 应在流结束后 resolve', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      // eslint-disable-next-line no-empty
      for await (const _ of stream) {}

      await expect(stream.done).resolves.toBeUndefined()
    })

    it('response 属性应在连接建立后可用', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      const iterator = stream[Symbol.asyncIterator]()
      await iterator.next()

      expect(stream.response).toBeDefined()
      expect(stream.response!.status).toBe(200)

      // eslint-disable-next-line no-empty
      while (!(await iterator.next()).done) {}
    })
  })

  describe('通用 SSE', () => {
    it('应解析自定义 event 类型', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/generic')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(events[0].event).toBe('custom')
      expect(events[1].event).toBeUndefined()
      expect(events[2].event).toBe('special')
    })

    it('应解析 id 字段', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/generic')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(events[0].id).toBe('1')
      expect(events[1].id).toBe('2')
    })

    it('应解析 retry 字段', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/generic')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(events[1].retry).toBe(3000)
    })

    it('多行 data 应正确拼接', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/generic')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(events[0].data).toBe('first event')
    })
  })

  describe('auth 和 Headers', () => {
    it('应注入 auth token', async () => {
      const client = new Request({
        prefix: baseUrl,
        auth: { getToken: () => 'test-token' },
      })
      const stream = createSSEStream(client.raw, '/sse/headers')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(events[0].data.authorization).toBe('Bearer test-token')
    })

    it('应注入 getHeaders 返回的额外 headers', async () => {
      const client = new Request({
        prefix: baseUrl,
        getHeaders: () => ({ 'X-Custom': 'custom-value' }),
      })
      const stream = createSSEStream(client.raw, '/sse/headers')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(events[0].data.customHeader).toBe('custom-value')
    })

    it('应支持自定义 headers 配置', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/headers', undefined, {
        headers: { 'X-Custom': 'from-config' },
      })

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(events[0].data.customHeader).toBe('from-config')
    })
  })

  describe('取消和错误处理', () => {
    it('cancel() 应能被调用且不抛错', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
        stream.cancel()
      }

      expect(events.length).toBeGreaterThanOrEqual(1)
    })

    it('非 200 响应应抛出错误', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/error')

      await expect(async () => {
        // eslint-disable-next-line no-empty
        for await (const _ of stream) {}
      }).rejects.toThrow()
    })

    it('重复迭代应抛出错误', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      // eslint-disable-next-line no-empty
      for await (const _ of stream) {}

      await expect(async () => {
        // eslint-disable-next-line no-empty
        for await (const _ of stream) {}
      }).rejects.toThrow('SSEStream can only be iterated once')
    })

    it('signal 应能取消请求', async () => {
      const client = new Request({ prefix: baseUrl })
      const controller = new AbortController()
      const stream = createSSEStream(client.raw, '/sse/chat', undefined, { signal: controller.signal })

      controller.abort()

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }
      expect(events.length).toBe(0)
    })
  })

  describe('uRL 处理', () => {
    it('prefix + /开头 URL 应去除开头斜杠', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }
      expect(events).toHaveLength(3)
      expect(events[0].data.choices[0].delta.content).toBe('Hello')
    })

    it('prefix + 无斜杠 URL 应正常拼接', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, 'sse/chat')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }
      expect(events).toHaveLength(3)
      expect(events[0].data.choices[0].delta.content).toBe('Hello')
    })
  })

  describe('自定义请求体', () => {
    it('应发送 JSON body', async () => {
      const client = new Request({ prefix: baseUrl })
      const body = {
        echoRequest: true,
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
      }
      const stream = createSSEStream(client.raw, '/sse/chat', body)

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }
      expect(events).toHaveLength(1)
      expect(events[0].data.method).toBe('POST')
      expect(events[0].data.body).toEqual(body)
    })

    it('应支持自定义 method', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat?echoRequest=1', undefined, { method: 'GET' })

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }
      expect(events).toHaveLength(1)
      expect(events[0].data).toEqual({ method: 'GET', body: null })
    })
  })

  describe('createClient 集成', () => {
    it('应通过 createClient 使用', async () => {
      const client = createClient({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }
      expect(events.length).toBe(3)
    })
  })

  describe('emitter 模式', () => {
    it('on(data) 应接收事件', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      const events: any[] = []
      stream.on('data', (event) => {
        events.push(event)
      })

      await stream.done
      expect(events).toHaveLength(3)
    })

    it('on(close) 应在流结束时调用', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      let closed = false
      stream.on('close', () => {
        closed = true
      })

      await stream.done
      expect(closed).toBe(true)
    })

    it('on(error) 应在错误时调用', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/error')

      let errorMsg = ''
      stream.on('error', (error) => {
        errorMsg = error.message
      })

      await stream.done
      expect(errorMsg.length).toBeGreaterThan(0)
    })

    it('off 应能移除监听器', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      const events: any[] = []
      const handler = (event: any) => {
        events.push(event)
      }

      stream.on('data', handler)
      // 立即移除，不应收到事件
      stream.off('data', handler)

      await stream.done
      expect(events).toHaveLength(0)
    })

    it('应支持链式调用', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      const events: any[] = []
      stream
        .on('data', (event) => {
          events.push(event)
        })
        .on('close', () => {})

      await stream.done
      expect(events).toHaveLength(3)
    })

    it('多个 data 监听器应都收到事件', async () => {
      const client = new Request({ prefix: baseUrl })
      const stream = createSSEStream(client.raw, '/sse/chat')

      let count1 = 0
      let count2 = 0
      stream.on('data', () => {
        count1++
      })
      stream.on('data', () => {
        count2++
      })

      await stream.done
      expect(count1).toBe(3)
      expect(count2).toBe(3)
    })
  })

  describe('createSSEStreamFromResponse', () => {
    it('应能接收已有 Response 并通过 async iteration 消费', async () => {
      const client = new Request({ prefix: baseUrl })
      const response = await client.raw('sse/chat', {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
      })

      const stream = createSSEStreamFromResponse(response)
      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(events).toHaveLength(3)
      expect(events[0].data.choices[0].delta.content).toBe('Hello')
    })

    it('应能接收已有 Response 并通过 emitter 消费', async () => {
      const client = new Request({ prefix: baseUrl })
      const response = await client.raw('sse/chat', {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
      })

      const stream = createSSEStreamFromResponse(response)
      const events: any[] = []
      stream.on('data', (event) => {
        events.push(event)
      })

      await stream.done
      expect(events).toHaveLength(3)
    })

    it('应支持 parser=text', async () => {
      const client = new Request({ prefix: baseUrl })
      const response = await client.raw('sse/chat', {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
      })

      const stream = createSSEStreamFromResponse(response, { parser: 'text' })

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      expect(typeof events[0].data).toBe('string')
    })

    it('应支持自定义 doneSignal', async () => {
      const client = new Request({ prefix: baseUrl })
      const response = await client.raw('sse/chat', {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
      })

      // doneSignal=null 禁用自动结束，依赖流关闭
      const stream = createSSEStreamFromResponse(response, { doneSignal: null })

      const events: any[] = []
      for await (const event of stream) {
        events.push(event)
      }

      // [DONE] 不会被过滤，但流结束后 iterator 自然完成
      expect(events.length).toBeGreaterThanOrEqual(3)
    })

    it('response 属性应为传入的 Response', async () => {
      const client = new Request({ prefix: baseUrl })
      const response = await client.raw('sse/chat', {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
      })

      const stream = createSSEStreamFromResponse(response)
      // eslint-disable-next-line no-empty
      for await (const _ of stream) {}

      expect(stream.response).toBe(response)
    })
  })
})
