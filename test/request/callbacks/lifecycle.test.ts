import type { HTTPError } from '../../../src'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { isHTTPError, Request, to } from '../../../src'

import { getBaseUrl } from '../helpers'

describe('request 生命周期回调', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = getBaseUrl()
  })

  describe('生命周期回调', () => {
    it('onRequest 实例级应被调用', async () => {
      const onRequestFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onRequest: onRequestFn,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      await request.get('/success')
      expect(onRequestFn).toHaveBeenCalledWith('GET', expect.stringContaining('success'))
    })

    it('onRequest 请求级应覆盖实例级', async () => {
      const instanceFn = vi.fn()
      const requestFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onRequest: instanceFn,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      await request.get('/success', { onRequest: requestFn })
      expect(instanceFn).not.toHaveBeenCalled()
      expect(requestFn).toHaveBeenCalledWith('GET', `${baseUrl}/success`)
    })

    it('onResponse 成功响应时应被调用', async () => {
      const onResponseFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onResponse: onResponseFn,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      await request.get('/success')
      expect(onResponseFn).toHaveBeenCalledWith('GET', expect.stringContaining('success'), 200)
    })

    it('onResponse HTTP 错误时应被调用', async () => {
      const onResponseFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onResponse: onResponseFn,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      await to(request.get('/error/http/500'))
      expect(onResponseFn).toHaveBeenCalledWith('GET', expect.stringContaining('error/http/500'), 500)
    })

    it('onError HTTP 错误时应被调用', async () => {
      const onErrorFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onError: onErrorFn,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const [error] = await to(request.get('/error/http/500'))
      expect(isHTTPError(error)).toBe(true)
      const [errorArg, responseArg] = onErrorFn.mock.calls[0]
      expect(errorArg).toBe(error)
      expect(responseArg).toBeInstanceOf(Response)
      expect((responseArg as Response).status).toBe(500)
    })

    it('onError 请求级应覆盖实例级', async () => {
      const instanceFn = vi.fn()
      const requestFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onError: instanceFn,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      await to(request.get('/error/http/500', { onError: requestFn }))
      expect(instanceFn).not.toHaveBeenCalled()
      expect(requestFn).toHaveBeenCalledWith(expect.any(Error), expect.any(Response))
    })

    it('onUnauthorized 401 响应时应被调用', async () => {
      const onUnauthorizedFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onUnauthorized: onUnauthorizedFn,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      await to(request.get('/error/http/401'))
      expect(onUnauthorizedFn).toHaveBeenCalledTimes(1)
    })

    it('onUnauthorized 非 401 响应时不应被调用', async () => {
      const onUnauthorizedFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onUnauthorized: onUnauthorizedFn,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      await to(request.get('/error/http/500'))
      expect(onUnauthorizedFn).not.toHaveBeenCalled()
    })

    it('onUnauthorized 无 responseParser 时仍应被调用', async () => {
      const onUnauthorizedFn = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        onUnauthorized: onUnauthorizedFn,
      })

      await to(request.get('/error/http/401'))
      expect(onUnauthorizedFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('传输错误回调', () => {
    it('无 responseParser 时 HTTPError 应保留原始响应并触发错误回调', async () => {
      const onResponseFn = vi.fn()
      const onErrorFn = vi.fn()
      const makeErrorMessageFn = vi.fn()

      const request = new Request({
        prefix: baseUrl,
        onResponse: onResponseFn,
        onError: onErrorFn,
        makeErrorMessage: makeErrorMessageFn,
      })

      const [error] = await to(request.get('/error/http/500'))

      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(500)
      expect(onResponseFn).toHaveBeenCalledWith('GET', expect.stringContaining('error/http/500'), 500)
      expect(onErrorFn).toHaveBeenCalledWith(error, (error as HTTPError).response)
      expect(makeErrorMessageFn).toHaveBeenCalledWith(expect.any(String), error)
    })

    it('超时错误没有 Response，但仍触发错误回调', async () => {
      const onErrorFn = vi.fn()
      const makeErrorMessageFn = vi.fn()

      const request = new Request({
        prefix: baseUrl,
        onError: onErrorFn,
        makeErrorMessage: makeErrorMessageFn,
        timeout: 100,
      })

      const [error] = await to(request.get('/timeout'))

      expect(error).toBeInstanceOf(Error)
      expect(onErrorFn).toHaveBeenCalledWith(error, undefined)
      expect(makeErrorMessageFn).toHaveBeenCalledWith(expect.any(String), error)
    })
  })
})
