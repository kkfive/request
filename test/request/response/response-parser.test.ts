import type { HTTPError } from '../../../src'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { BusinessError, isHTTPError, Request, to } from '../../../src'

import { getBaseUrl } from '../helpers'

describe('request 响应解析与错误处理', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = getBaseUrl()
  })

  describe('unwrap 参数', () => {
    it('unwrap=true 且有实例 responseParser 时应返回 data 字段', async () => {
      const request = new Request({
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

      const result = await request.get<string>('/success', { unwrap: true })
      // 验证返回的是 /success 端点的 data 字段内容（随机字符串）
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('unwrap=false 且有实例 responseParser 时应返回完整响应体', async () => {
      const request = new Request({
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

      const result = await request.get<{ success: boolean, data: string }>('/success', { unwrap: false })
      expect(result).toHaveProperty('success', true)
      // data 字段是随机字符串
      expect(result).toHaveProperty('data')
      expect(typeof result.data).toBe('string')
    })

    it('unwrap=true 但无实例 responseParser 时应被忽略', async () => {
      const request = new Request({ prefix: baseUrl })

      const result = await request.get('/success', { unwrap: true })
      expect(typeof result).toBe('object')
      expect(result).toHaveProperty('success', true)
    })
  })

  describe('responseParser 详细测试', () => {
    it('responseReturn=raw 应返回 Response 实例', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: { responseReturn: 'raw' },
      })

      const result = await request.get('/success')
      expect(result).toBeInstanceOf(Response)
    })

    it('responseReturn=body 成功响应应返回完整 JSON', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: { responseReturn: 'body' },
      })

      const result = await request.get('/success')
      expect(result).toEqual({
        success: true,
        data: expect.any(String),
      })
    })

    it('responseReturn=body HTTP 错误应抛出 ky HTTPError', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: { responseReturn: 'body' },
      })

      const [error] = await to(request.get('/error/http/500'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(500)
    })

    it('dataField 为函数时应返回函数处理结果', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: (res: any) => ({ processed: res.data }),
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<{ processed: string }>('/success')
      expect(result).toHaveProperty('processed')
    })

    it('successCode 为数值时应正确判断', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'code',
          dataField: 'data',
          successCode: 0,
          errorCodeField: 'code',
          errorMessageField: 'msg',
        },
      })

      const result = await request.get<string>('/custom-code')
      expect(result).toBe('custom code response')
    })

    it('successCode 为函数返回 false 时应抛出业务错误', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: () => false,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const [error] = await to(request.get('/success'))
      expect(error).toBeInstanceOf(BusinessError)
    })

    it('errorMessageField 为函数时应使用函数返回的消息', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: (res: any) => `Custom: ${res.msg}`,
        },
      })

      const [error] = await to(request.get('/custom-message'))
      expect(error?.message).toBe('Custom: 自定义错误消息')
    })

    it('无 errorMessageField 时应使用 msg 字段', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'nonexistent',
        },
      })

      const [error] = await to(request.get('/custom-message'))
      expect(error?.message).toBe('自定义错误消息')
    })
  })

  describe('hTTP 错误状态码', () => {
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

    it('400 应以 ky HTTPError 抛出', async () => {
      const request = createParsedRequest()
      const [error] = await to(request.get('/error/http/400'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(400)
    })

    it('401 应以 ky HTTPError 抛出', async () => {
      const request = createParsedRequest()
      const [error] = await to(request.get('/error/http/401'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(401)
    })

    it('403 应以 ky HTTPError 抛出', async () => {
      const request = createParsedRequest()
      const [error] = await to(request.get('/error/http/403'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(403)
    })

    it('404 应以 ky HTTPError 抛出', async () => {
      const request = createParsedRequest()
      const [error] = await to(request.get('/error/http/404'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(404)
    })

    it('500 应以 ky HTTPError 抛出', async () => {
      const request = createParsedRequest()
      const [error] = await to(request.get('/error/http/500'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(500)
    })

    it('418 应以 ky HTTPError 抛出', async () => {
      const request = createParsedRequest()
      const [error] = await to(request.get('/error/http/418'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(418)
    })
  })

  describe('错误处理', () => {
    it('业务错误应抛出 BusinessError 并携带业务 code', async () => {
      const request = new Request({
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

      const [error] = await to(request.get('/error/business/500'))
      expect(error).toBeInstanceOf(BusinessError)
      expect((error as BusinessError).code).toBe(500)
    })

    it('makeErrorMessage 实例级应被调用', async () => {
      const makeErrorMessageFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        makeErrorMessage: makeErrorMessageFn,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      await to(request.get('/error/business/500'))
      expect(makeErrorMessageFn).toHaveBeenCalledWith('业务错误', expect.any(BusinessError))
    })

    it('makeErrorMessage 请求级应覆盖实例级', async () => {
      const instanceFn = vi.fn()
      const requestFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        makeErrorMessage: instanceFn,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      await to(request.get('/error/business/500', { makeErrorMessage: requestFn }))
      expect(instanceFn).not.toHaveBeenCalled()
      expect(requestFn).toHaveBeenCalledWith('业务错误', expect.any(BusinessError))
    })
  })
})
