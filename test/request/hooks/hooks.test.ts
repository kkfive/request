import type { AfterResponseHook, BeforeRequestHook } from 'ky'
import type { EchoData, FormDataResponse } from '../../types'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createAuthHook, createContentTypeHook, createResponseParserHook, createUnauthorizedHook, paramsSerializerHook, Request, to } from '../../../src'
import { resolveHooks } from '../../../src/hooks'

import { getBaseUrl } from '../helpers'

describe('request hooks 管理', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = getBaseUrl()
  })

  describe('hook registry 顺序', () => {
    it('应按固定顺序注册 beforeRequest / afterResponse 的 prepend、内置、append、legacy hooks', () => {
      const beforePrepend: BeforeRequestHook = vi.fn()
      const beforeAppend: BeforeRequestHook = vi.fn()
      const legacyBefore: BeforeRequestHook = vi.fn()
      const afterPrepend: AfterResponseHook = vi.fn(({ response }) => response)
      const afterAppend: AfterResponseHook = vi.fn(({ response }) => response)
      const legacyAfter: AfterResponseHook = vi.fn(({ response }) => response)
      const paramsSerializer: BeforeRequestHook = vi.fn()
      const auth: BeforeRequestHook = vi.fn()
      const contentType: BeforeRequestHook = vi.fn()
      const unauthorized: AfterResponseHook = vi.fn(({ response }) => response)
      const responseParser: AfterResponseHook = vi.fn(({ response }) => response)

      const hooks = resolveHooks({
        auth: { getToken: () => 'token' },
        responseParser: { responseReturn: 'data' },
        extendedHooks: {
          beforeRequest: {
            prepend: [beforePrepend],
            append: [beforeAppend],
          },
          afterResponse: {
            prepend: [afterPrepend],
            append: [afterAppend],
          },
          control: {
            replace: {
              paramsSerializer,
              auth,
              contentType,
              unauthorized,
              responseParser,
            },
          },
        },
        hooks: {
          beforeRequest: [legacyBefore],
          afterResponse: [legacyAfter],
        },
      })

      expect(hooks.beforeRequest).toEqual([
        beforePrepend,
        paramsSerializer,
        auth,
        contentType,
        beforeAppend,
        legacyBefore,
      ])
      expect(hooks.afterResponse).toEqual([
        afterPrepend,
        unauthorized,
        responseParser,
        afterAppend,
        legacyAfter,
      ])
    })

    it('disable 应只移除指定内置 hook，不改变剩余 hook 的相对顺序', () => {
      const beforePrepend: BeforeRequestHook = vi.fn()
      const beforeAppend: BeforeRequestHook = vi.fn()
      const afterPrepend: AfterResponseHook = vi.fn(({ response }) => response)
      const afterAppend: AfterResponseHook = vi.fn(({ response }) => response)
      const paramsSerializer: BeforeRequestHook = vi.fn()
      const auth: BeforeRequestHook = vi.fn()
      const contentType: BeforeRequestHook = vi.fn()
      const unauthorized: AfterResponseHook = vi.fn(({ response }) => response)
      const responseParser: AfterResponseHook = vi.fn(({ response }) => response)

      const hooks = resolveHooks({
        auth: { getToken: () => 'token' },
        responseParser: { responseReturn: 'data' },
        extendedHooks: {
          beforeRequest: {
            prepend: [beforePrepend],
            append: [beforeAppend],
          },
          afterResponse: {
            prepend: [afterPrepend],
            append: [afterAppend],
          },
          control: {
            disable: ['auth', 'responseParser'],
            replace: {
              paramsSerializer,
              auth,
              contentType,
              unauthorized,
              responseParser,
            },
          },
        },
      })

      expect(hooks.beforeRequest).toEqual([
        beforePrepend,
        paramsSerializer,
        contentType,
        beforeAppend,
      ])
      expect(hooks.afterResponse).toEqual([
        afterPrepend,
        unauthorized,
        afterAppend,
      ])
    })

    it('数组形式 extendedHooks 应作为 append 处理并排在 legacy hooks 之前', () => {
      const arrayBefore: BeforeRequestHook = vi.fn()
      const legacyBefore: BeforeRequestHook = vi.fn()
      const arrayAfter: AfterResponseHook = vi.fn(({ response }) => response)
      const legacyAfter: AfterResponseHook = vi.fn(({ response }) => response)
      const paramsSerializer: BeforeRequestHook = vi.fn()
      const contentType: BeforeRequestHook = vi.fn()
      const unauthorized: AfterResponseHook = vi.fn(({ response }) => response)

      const hooks = resolveHooks({
        extendedHooks: {
          beforeRequest: [arrayBefore],
          afterResponse: [arrayAfter],
          control: {
            replace: {
              paramsSerializer,
              contentType,
              unauthorized,
            },
          },
        },
        hooks: {
          beforeRequest: [legacyBefore],
          afterResponse: [legacyAfter],
        },
      })

      expect(hooks.beforeRequest).toEqual([
        paramsSerializer,
        contentType,
        arrayBefore,
        legacyBefore,
      ])
      expect(hooks.afterResponse).toEqual([
        unauthorized,
        arrayAfter,
        legacyAfter,
      ])
    })
  })

  describe('hooks 合并', () => {
    it('beforeRequest 顺序应固定为 prepend -> paramsSerializer -> auth -> contentType -> append -> legacy hooks', async () => {
      const calls: string[] = []
      const auth = { getToken: () => 'token' }
      const paramsSerializer: BeforeRequestHook = async (state) => {
        calls.push('paramsSerializer')
        return paramsSerializerHook(state)
      }
      const authHook: BeforeRequestHook = async (state) => {
        calls.push('auth')
        return createAuthHook(auth)(state)
      }
      const contentType: BeforeRequestHook = async (state) => {
        calls.push('contentType')
        return createContentTypeHook()(state)
      }

      const request = new Request({
        prefix: baseUrl,
        auth,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
        extendedHooks: {
          beforeRequest: {
            prepend: [({ request }) => {
              calls.push(`prepend:${new URL(request.url).search || 'no-query'}:${request.headers.get('Authorization') ?? 'no-auth'}:${request.headers.get('Content-Type') ?? 'no-content-type'}`)
            }],
            append: [({ request }) => {
              calls.push(`append:${new URL(request.url).search}:${request.headers.get('Authorization')}:${request.headers.get('Content-Type')}`)
            }],
          },
          control: {
            replace: {
              paramsSerializer,
              auth: authHook,
              contentType,
            },
          },
        },
        hooks: {
          beforeRequest: [({ request }) => {
            calls.push(`legacy:${new URL(request.url).search}:${request.headers.get('Authorization')}:${request.headers.get('Content-Type')}`)
          }],
        },
      })

      await request.get('/headers/check', {
        params: { ids: [1, 2] },
      })

      expect(calls).toEqual([
        'prepend:no-query:no-auth:no-content-type',
        'paramsSerializer',
        'auth',
        'contentType',
        'append:?ids=1%2C2:Bearer token:application/json;charset=utf-8',
        'legacy:?ids=1%2C2:Bearer token:application/json;charset=utf-8',
      ])
    })

    it('afterResponse 顺序应固定为 prepend -> unauthorized -> responseParser -> append -> legacy hooks', async () => {
      const calls: string[] = []
      const unauthorized: AfterResponseHook = async (state) => {
        calls.push(`unauthorized:${state.response.status}`)
        return createUnauthorizedHook()(state)
      }
      const responseParser: AfterResponseHook = async (state) => {
        calls.push(`responseParser:${state.response.status}`)
        return createResponseParserHook()(state)
      }

      const request = new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
        extendedHooks: {
          afterResponse: {
            prepend: [async ({ response }) => {
              calls.push(`prepend:${response.status}:${typeof await response.clone().json()}`)
              return response
            }],
            append: [async ({ response }) => {
              calls.push(`append:${response.status}:${typeof await response.clone().json()}`)
              return response
            }],
          },
          control: {
            replace: {
              unauthorized,
              responseParser,
            },
          },
        },
        hooks: {
          afterResponse: [async ({ response }) => {
            calls.push(`legacy:${response.status}:${typeof await response.clone().json()}`)
            return response
          }],
        },
      })

      await request.get('/success')

      expect(calls).toEqual([
        'prepend:200:object',
        'unauthorized:200',
        'responseParser:200',
        'append:200:string',
        'legacy:200:string',
      ])
    })

    it('401 refresh 场景应先执行 unauthorized，重试成功后才执行 responseParser 和 append hooks', async () => {
      const calls: string[] = []
      let refreshed = false
      const auth = {
        getToken: () => refreshed ? 'new-token' : 'old-token',
        refreshToken: {
          getRefreshToken: () => 'refresh-token',
          refresh: async () => {
            calls.push('refresh')
            refreshed = true
            return 'new-token'
          },
        },
      }
      const unauthorized: AfterResponseHook = async (state) => {
        calls.push(`unauthorized:${state.response.status}:${state.retryCount}`)
        return createUnauthorizedHook(undefined, auth)(state)
      }
      const responseParser: AfterResponseHook = async (state) => {
        calls.push(`responseParser:${state.response.status}:${state.retryCount}`)
        return createResponseParserHook()(state)
      }

      const request = new Request({
        prefix: baseUrl,
        auth,
        responseParser: { responseReturn: 'data' },
        extendedHooks: {
          afterResponse: {
            prepend: [({ response, retryCount }) => {
              calls.push(`prepend:${response.status}:${retryCount}`)
              return response
            }],
            append: [async ({ response, retryCount }) => {
              calls.push(`append:${response.status}:${retryCount}:${typeof await response.clone().json()}`)
              return response
            }],
          },
          control: {
            replace: {
              unauthorized,
              responseParser,
            },
          },
        },
      })

      await request.get('/auth/protected')

      expect(calls).toEqual([
        'prepend:401:0',
        'unauthorized:401:0',
        'refresh',
        'prepend:200:1',
        'unauthorized:200:1',
        'responseParser:200:1',
        'append:200:1:object',
      ])
    })

    it('afterResponse hook 应合并执行', async () => {
      const instanceHook = vi.fn(({ response }: any) => response)
      const requestHook = vi.fn(({ response }: any) => response)

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
        hooks: {
          afterResponse: [instanceHook],
        },
      })

      await request.get('/success', {
        hooks: { afterResponse: [requestHook] },
      })

      expect(instanceHook).toHaveBeenCalledTimes(1)
      expect(requestHook).toHaveBeenCalledTimes(1)
    })

    it('数组形式的 extendedHooks 应正确处理', async () => {
      const beforeHook1 = vi.fn()
      const beforeHook2 = vi.fn()

      const request = new Request({
        prefix: baseUrl,
        extendedHooks: {
          beforeRequest: [beforeHook1, beforeHook2],
        },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
      })

      await request.get('/success')

      expect(beforeHook1).toHaveBeenCalledTimes(1)
      expect(beforeHook2).toHaveBeenCalledTimes(1)
    })

    it('control.disable 应禁用指定 hook', async () => {
      const request = new Request({
        prefix: baseUrl,
        auth: { getToken: () => 'token' },
        extendedHooks: {
          control: {
            disable: ['auth'],
          },
        },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
      })

      // 验证 auth hook 被禁用
      const result = await request.get<EchoData>('/auth/check')
      expect(result.authorization).toBeNull()
    })

    it('features.enableAuth=false 应禁用 auth hook', async () => {
      const request = new Request({
        prefix: baseUrl,
        features: { enableAuth: false },
        auth: { getToken: () => 'token' },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
      })

      // 验证请求不包含 Authorization header
      const result = await request.get<EchoData>('/auth/check')
      expect(result.authorization).toBeNull()
    })

    it('features.enableResponseParser=false 应禁用响应解析', async () => {
      const request = new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'code',
          dataField: 'data',
          successCode: 0,
        },
        features: { enableResponseParser: false },
      })

      const result = await request.get('/success')

      expect(result).toEqual({
        success: true,
        data: expect.any(String),
      })
    })

    it('features.enableParamsSerializer=false 应禁用参数序列化', async () => {
      const request = new Request({
        prefix: baseUrl,
        features: { enableParamsSerializer: false },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
      })

      // 当禁用 paramsSerializer 时，params 不会被处理
      // ky 会忽略 params 选项
      const result = await request.get<EchoData>('/params', {
        params: { ids: [1, 2, 3] },
      })

      // 验证 query 为空（因为 params 没有被序列化）
      expect(result.rawQuery).toBe('')
    })

    it('features.enableContentType=false 应禁用 contentType hook', async () => {
      const request = new Request({
        prefix: baseUrl,
        features: { enableContentType: false },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
      })

      const result = await request.get<string>('/success')
      expect(result).toEqual(expect.any(String))
      expect(result).not.toHaveLength(0)
    })

    it('formData 请求应移除实例级 Content-Type，让 fetch 自动设置 boundary', async () => {
      const request = new Request({
        prefix: baseUrl,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const formData = new FormData()
      formData.append('file', new Blob(['content']), 'test.txt')

      const result = await request.post<FormDataResponse>('/formdata', formData)

      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.contentType).toContain('multipart/form-data')
      expect(result.data.contentType).toContain('boundary=')
      expect(result.data.contentType).not.toContain('application/json')
    })

    it('formData 请求应移除请求级 Content-Type', async () => {
      const request = new Request({
        prefix: baseUrl,
      })

      const formData = new FormData()
      formData.append('name', 'avatar')

      const result = await request.post<FormDataResponse>('/formdata', formData, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.contentType).toContain('boundary=')
      expect(result.data.contentType).not.toContain('application/json')
    })

    it('formData 请求应移除 getHeaders 注入的 Content-Type', async () => {
      const request = new Request({
        prefix: baseUrl,
        getHeaders: () => ({
          'Content-Type': 'application/json',
          'X-Custom-Header': 'upload',
        }),
      })

      const formData = new FormData()
      formData.append('name', 'avatar')

      const result = await request.post<FormDataResponse>('/formdata', formData)

      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.contentType).toContain('boundary=')
      expect(result.data.contentType).not.toContain('application/json')
    })

    it('features.enableUnauthorizedHandler=false 应禁用 unauthorized hook', async () => {
      const onUnauthorized = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        features: { enableUnauthorizedHandler: false },
        onUnauthorized,
      })

      // 验证 401 不会触发 onUnauthorized
      await to(request.get('/error/http/401'))
      expect(onUnauthorized).not.toHaveBeenCalled()
    })

    it('extendedHooks 对象形式的 prepend/append 应正确处理', async () => {
      const prependHook = vi.fn()
      const appendHook = vi.fn()

      const request = new Request({
        prefix: baseUrl,
        extendedHooks: {
          beforeRequest: {
            prepend: [prependHook],
            append: [appendHook],
          },
        },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
      })

      await request.get('/success')

      expect(prependHook).toHaveBeenCalledTimes(1)
      expect(appendHook).toHaveBeenCalledTimes(1)
    })

    it('extendedHooks 对象形式只有 prepend 应正确处理', async () => {
      const prependHook = vi.fn()

      const request = new Request({
        prefix: baseUrl,
        extendedHooks: {
          beforeRequest: {
            prepend: [prependHook],
          },
        },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
      })

      await request.get('/success')

      expect(prependHook).toHaveBeenCalledTimes(1)
    })

    it('control.replace 应替换指定的内置 hook', async () => {
      const customAuthHook = vi.fn()

      const request = new Request({
        prefix: baseUrl,
        auth: { getToken: () => 'token' },
        extendedHooks: {
          control: {
            replace: {
              auth: customAuthHook,
            },
          },
        },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
      })

      await request.get('/success')

      expect(customAuthHook).toHaveBeenCalledTimes(1)
    })
  })
})
