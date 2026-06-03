import type { EchoData, FormDataResponse } from '../../types'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { BusinessError, Request, to } from '../../../src'

import { getBaseUrl } from '../helpers'

describe('request 请求选项', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = getBaseUrl()
  })

  describe('params 序列化', () => {
    function createParsedRequest(): Request {
      return new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })
    }

    it('默认 comma 模式应序列化为 ids=1,2,3', async () => {
      const request = createParsedRequest()
      const result = await request.get<EchoData>('/params', {
        params: { ids: [1, 2, 3] },
      })
      expect(result.rawQuery).toBe('?ids=1%2C2%2C3')
    })

    it('brackets 模式应序列化为 ids[]=1&ids[]=2&ids[]=3', async () => {
      const request = createParsedRequest()
      const result = await request.get<EchoData>('/params', {
        params: { ids: [1, 2, 3] },
        paramsSerializer: 'brackets',
      })
      expect(result.rawQuery).toBe('?ids%5B%5D=1&ids%5B%5D=2&ids%5B%5D=3')
    })

    it('indices 模式应序列化为 ids[0]=1&ids[1]=2&ids[2]=3', async () => {
      const request = createParsedRequest()
      const result = await request.get<EchoData>('/params', {
        params: { ids: [1, 2, 3] },
        paramsSerializer: 'indices',
      })
      expect(result.rawQuery).toBe('?ids%5B0%5D=1&ids%5B1%5D=2&ids%5B2%5D=3')
    })

    it('repeat 模式应序列化为 ids=1&ids=2&ids=3', async () => {
      const request = createParsedRequest()
      const result = await request.get<EchoData>('/params', {
        params: { ids: [1, 2, 3] },
        paramsSerializer: 'repeat',
      })
      expect(result.rawQuery).toBe('?ids=1&ids=2&ids=3')
    })

    it('无 params 时应无 query string', async () => {
      const request = createParsedRequest()
      const result = await request.get<EchoData>('/params')
      expect(result.rawQuery).toBe('')
    })

    it('混合参数应正确序列化', async () => {
      const request = createParsedRequest()
      const result = await request.get<EchoData>('/params', {
        params: { name: 'test', ids: [1, 2] },
      })
      expect(result.query?.name).toBe('test')
    })
  })

  describe('uRL 处理', () => {
    it('prefix + /开头 URL 应去除开头斜杠', async () => {
      const onRequest = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onRequest,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<string>('/success')
      expect(result).toEqual(expect.any(String))
      expect(result).not.toHaveLength(0)
      expect(onRequest).toHaveBeenCalledWith('GET', `${baseUrl}/success`)
    })

    it('prefix + 无斜杠 URL 应正常拼接', async () => {
      const onRequest = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onRequest,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<string>('success')
      expect(result).toEqual(expect.any(String))
      expect(result).not.toHaveLength(0)
      expect(onRequest).toHaveBeenCalledWith('GET', `${baseUrl}/success`)
    })

    it('请求级 prefix 应覆盖实例级', async () => {
      const onRequest = vi.fn()
      const request = new Request({
        prefix: 'http://invalid-url',
        onRequest,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<string>('/success', { prefix: baseUrl })
      expect(result).toEqual(expect.any(String))
      expect(result).not.toHaveLength(0)
      expect(onRequest).toHaveBeenCalledWith('GET', `${baseUrl}/success`)
    })
  })

  describe('请求取消', () => {
    it('abortController.abort() 应取消请求', async () => {
      const request = new Request({ prefix: baseUrl })
      const controller = Request.createAbortController()

      setTimeout(() => controller.abort(), 10)

      const [error] = await to(request.get('/timeout', { signal: controller.signal }))
      expect(error).toBeInstanceOf(Error)
      expect(error?.name).toBe('AbortError')
    })
  })

  describe('responseParser 边界条件', () => {
    it('默认 errorMessageField 应使用 message 字段', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          // 不设置 errorMessageField，应该使用默认值 'message'
        },
      })

      const [error] = await to(request.get('/error/business/500'))
      expect(error).toBeInstanceOf(BusinessError)
      // /error/business/500 返回 errorMessage 字段，而默认取 message；message/msg 均不存在，
      // 因此回退到英文默认文案 'API Response Failed'
      expect(error?.message).toBe('API Response Failed')
    })

    it('responseReturn=raw 时应直接返回 Response', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'raw',
        },
      })

      const result = await request.get('/success')
      expect(result).toBeInstanceOf(Response)
    })

    it('无 prefix 时应直接使用 url', async () => {
      const request = new Request({
        // 不设置 prefix
        responseParser: {
          responseReturn: 'body',
        },
      })

      // 使用完整 URL
      const result = await request.get(`${baseUrl}/success`)
      expect(result).toHaveProperty('success', true)
    })

    it('method 未指定时应默认为 GET', async () => {
      const onRequestFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onRequest: onRequestFn,
      })

      await request.request<FormDataResponse>('/success', {})
      expect(onRequestFn).toHaveBeenCalledWith('GET', expect.stringContaining('success'))
    })
  })
})
