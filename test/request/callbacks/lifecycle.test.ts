import type { HTTPError, StandardSchemaV1 } from '../../../src'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { BusinessError, isHTTPError, Request, SchemaValidationError, to } from '../../../src'

import { getBaseUrl } from '../helpers'

function createTracingSchema(calls: string[], valid = true): StandardSchemaV1<unknown, unknown> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value) => {
        calls.push('schema')
        return valid
          ? { value }
          : { issues: [{ message: 'invalid' }] }
      },
    },
  }
}

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

    it('成功请求顺序应为 onRequest -> hooks -> onResponse -> schema -> onValidationError', async () => {
      const calls: string[] = []
      const request = new Request({
        prefix: baseUrl,
        onRequest: () => calls.push('onRequest'),
        onResponse: () => calls.push('onResponse'),
        onValidationError: () => calls.push('onValidationError'),
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
        schemaValidation: 'warn',
        extendedHooks: {
          beforeRequest: {
            prepend: [() => {
              calls.push('beforeRequest.prepend')
            }],
            append: [() => {
              calls.push('beforeRequest.append')
            }],
          },
          afterResponse: {
            prepend: [({ response }) => {
              calls.push('afterResponse.prepend')
              return response
            }],
            append: [({ response }) => {
              calls.push('afterResponse.append')
              return response
            }],
          },
        },
      })

      await request.get('/success', {
        schema: createTracingSchema(calls, false),
      })

      expect(calls).toEqual([
        'onRequest',
        'beforeRequest.prepend',
        'beforeRequest.append',
        'afterResponse.prepend',
        'afterResponse.append',
        'onResponse',
        'schema',
        'onValidationError',
      ])
    })

    it('业务错误顺序应为 onRequest -> afterResponse prepend -> onResponse -> onError', async () => {
      const calls: string[] = []
      const request = new Request({
        prefix: baseUrl,
        onRequest: () => calls.push('onRequest'),
        onResponse: () => calls.push('onResponse'),
        onError: () => calls.push('onError'),
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
        extendedHooks: {
          afterResponse: {
            prepend: [({ response }) => {
              calls.push('afterResponse.prepend')
              return response
            }],
            append: [({ response }) => {
              calls.push('afterResponse.append')
              return response
            }],
          },
        },
      })

      const [error] = await to(request.get('/error/business/500'))

      expect(error).toBeInstanceOf(BusinessError)
      expect(calls).toEqual([
        'onRequest',
        'afterResponse.prepend',
        'onResponse',
        'onError',
      ])
    })

    it('strict schema 错误应发生在 onResponse 之后且不触发 onError', async () => {
      const calls: string[] = []
      const request = new Request({
        prefix: baseUrl,
        onResponse: () => calls.push('onResponse'),
        onError: () => calls.push('onError'),
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
        extendedHooks: {
          afterResponse: {
            append: [({ response }) => {
              calls.push('afterResponse.append')
              return response
            }],
          },
        },
      })

      const [error] = await to(request.get('/success', {
        schema: createTracingSchema(calls, false),
      }))

      expect(error).toBeInstanceOf(SchemaValidationError)
      expect(calls).toEqual([
        'afterResponse.append',
        'onResponse',
        'schema',
      ])
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
