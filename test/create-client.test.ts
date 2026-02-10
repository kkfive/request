import { beforeAll, describe, expect, it } from 'vitest'
import { createClient, Request } from '../src'

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var __TEST_SERVER_URL__: string
}

describe('createClient 工厂函数', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = globalThis.__TEST_SERVER_URL__
  })

  describe('基本功能', () => {
    it('无参数调用应返回 Request 实例', () => {
      const client = createClient()
      expect(client).toBeInstanceOf(Request)
    })

    it('传入配置应返回配置正确的 Request 实例', () => {
      const client = createClient({
        prefixUrl: baseUrl,
        timeout: 5000,
      })
      expect(client).toBeInstanceOf(Request)
    })

    it('返回实例应具有所有 HTTP 方法', () => {
      const client = createClient()
      expect(typeof client.get).toBe('function')
      expect(typeof client.post).toBe('function')
      expect(typeof client.put).toBe('function')
      expect(typeof client.patch).toBe('function')
      expect(typeof client.delete).toBe('function')
      expect(typeof client.request).toBe('function')
    })

    it('返回实例应具有 raw getter', () => {
      const client = createClient()
      expect(client.raw).toBeDefined()
      expect(typeof client.raw).toBe('function')
    })

    it('静态方法 createAbortController 应可用', () => {
      const controller = Request.createAbortController()
      expect(controller).toBeInstanceOf(AbortController)
    })
  })

  describe('实例独立性', () => {
    it('多次调用应返回独立实例', () => {
      const client1 = createClient()
      const client2 = createClient()
      expect(client1).not.toBe(client2)
    })

    it('实例配置应互不影响', async () => {
      const client1 = createClient({
        prefixUrl: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const client2 = createClient({
        prefixUrl: baseUrl,
        responseParser: {
          responseReturn: 'body',
        },
      })

      const result1 = await client1.get('/success')
      const result2 = await client2.get('/success')

      // client1 返回 data 字段
      expect(typeof result1).toBe('string')

      // client2 返回完整 body
      expect(typeof result2).toBe('object')
      expect(result2).toHaveProperty('success', true)
      expect(result2).toHaveProperty('data')
    })
  })

  describe('完整配置测试', () => {
    it('应正确应用 auth 配置', async () => {
      const client = createClient({
        prefixUrl: baseUrl,
        auth: {
          getToken: () => 'test-token',
        },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await client.get('/auth/check')
      expect(result.authorization).toBe('Bearer test-token')
    })

    it('应正确应用 getHeaders 配置', async () => {
      const client = createClient({
        prefixUrl: baseUrl,
        getHeaders: () => ({
          'X-Custom-Header': 'custom-value',
        }),
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await client.get('/headers/check')
      expect(result.headers['x-custom-header']).toBe('custom-value')
    })

    it('应正确应用 responseParser 配置', async () => {
      const client = createClient({
        prefixUrl: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'code',
          dataField: 'data',
          successCode: 0,
          errorCodeField: 'code',
          errorMessageField: 'msg',
        },
      })

      const result = await client.get('/custom-code')
      expect(result).toBe('custom code response')
    })
  })
})
