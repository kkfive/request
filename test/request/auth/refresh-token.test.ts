import { beforeAll, describe, expect, it, vi } from 'vitest'
import { isHTTPError, Request, to } from '../../../src'

import { getBaseUrl } from '../helpers'

describe('request refresh token', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = getBaseUrl()
  })

  describe('refresh token 功能', () => {
    it('401 错误应触发 token 刷新并重试请求', async () => {
      let tokenRefreshed = false
      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => tokenRefreshed ? 'new-token' : 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              tokenRefreshed = true
              return 'new-token'
            },
          },
        },
        responseParser: {
          responseReturn: 'data',
        },
      })

      // 第一次请求会返回 401，触发刷新，然后重试成功
      const result = await request.get('/auth/protected')
      expect(result).toEqual({ id: 1, name: 'user' })
      // 验证 token 刷新逻辑被触发
      expect(tokenRefreshed).toBe(true)
    })

    it('token 刷新成功应调用 onRefreshSuccess', async () => {
      const onRefreshSuccess = vi.fn()
      let tokenRefreshed = false
      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => tokenRefreshed ? 'new-token' : 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              tokenRefreshed = true
              return 'new-token'
            },
            onRefreshSuccess,
          },
        },
        responseParser: {
          responseReturn: 'data',
        },
      })

      await request.get('/auth/protected')
      expect(onRefreshSuccess).toHaveBeenCalledWith('new-token')
    })

    it('token 刷新失败应调用 onRefreshFail', async () => {
      const onRefreshFail = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              throw new Error('Refresh failed')
            },
            onRefreshFail,
          },
        },
        responseParser: {
          responseReturn: 'data',
        },
      })

      await to(request.get('/error/http/401'))
      expect(onRefreshFail).toHaveBeenCalledWith(expect.any(Error))
    })

    it('token 刷新失败后应调用 onUnauthorized', async () => {
      const onUnauthorized = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              throw new Error('Refresh failed')
            },
          },
        },
        onUnauthorized,
        responseParser: {
          responseReturn: 'data',
        },
      })

      await to(request.get('/error/http/401'))
      expect(onUnauthorized).toHaveBeenCalled()
    })

    it('无 refreshToken 配置时 401 应直接调用 onUnauthorized', async () => {
      const onUnauthorized = vi.fn()
      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => 'token',
        },
        onUnauthorized,
        responseParser: {
          responseReturn: 'data',
        },
      })

      await to(request.get('/error/http/401'))
      expect(onUnauthorized).toHaveBeenCalled()
    })

    it('并发 401 请求应该只刷新一次 token（异步 getRefreshToken）', async () => {
      let refreshCount = 0
      let getRefreshTokenCount = 0
      let tokenRefreshed = false

      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => tokenRefreshed ? 'new-token' : 'old-token',
          refreshToken: {
            getRefreshToken: async () => {
              getRefreshTokenCount++
              await new Promise(resolve => setTimeout(resolve, 50))
              return 'refresh-token'
            },
            refresh: async (_token) => {
              refreshCount++
              await new Promise(resolve => setTimeout(resolve, 50))
              tokenRefreshed = true
              return 'new-token'
            },
          },
        },
        responseParser: {
          responseReturn: 'data',
        },
      })

      // 同时发起 5 个请求，都返回 401
      const results = await Promise.allSettled([
        request.get('/auth/protected'),
        request.get('/auth/protected'),
        request.get('/auth/protected'),
        request.get('/auth/protected'),
        request.get('/auth/protected'),
      ])

      // 验证所有请求都成功
      const successes = results.filter(r => r.status === 'fulfilled')
      expect(successes.length).toBe(5)

      // 验证只刷新了一次
      expect(getRefreshTokenCount).toBe(1)
      expect(refreshCount).toBe(1)
    })

    it('多个 client 实例的 token 刷新应该隔离', async () => {
      let apiTokenRefreshed = false
      let adminTokenRefreshed = false

      const apiClient = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => apiTokenRefreshed ? 'new-token' : 'api-token',
          refreshToken: {
            getRefreshToken: () => 'api-refresh',
            refresh: async () => {
              apiTokenRefreshed = true
              return 'new-token'
            },
          },
        },
      })

      const adminClient = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => adminTokenRefreshed ? 'new-token' : 'admin-token',
          refreshToken: {
            getRefreshToken: () => 'admin-refresh',
            refresh: async () => {
              adminTokenRefreshed = true
              return 'new-token'
            },
          },
        },
      })

      await Promise.all([
        apiClient.get('/auth/protected').catch(() => {}),
        adminClient.get('/auth/protected').catch(() => {}),
      ])

      expect(apiTokenRefreshed).toBe(true)
      expect(adminTokenRefreshed).toBe(true)
    })

    it('retry 请求应携带刷新后的新 token', async () => {
      let refreshed = false
      const authHookCalls: string[] = []

      const request = new Request({
        prefix: baseUrl,
        responseParser: { responseReturn: 'data' },
        auth: {
          getToken: () => refreshed ? 'new-token' : 'old-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              refreshed = true
              return 'new-token'
            },
          },
        },
        extendedHooks: {
          beforeRequest: {
            append: [({ request }) => {
              authHookCalls.push(request.headers.get('Authorization') || '')
            }],
          },
        },
      })

      // 初始请求带 old-token → 401 → 刷新 → ky.retry 显式携带 new-token → 成功
      const result = await request.get('/auth/protected')

      // beforeRequest 仅在初始请求执行一次，观察到 old-token（重试走 beforeRetry，不再重跑 beforeRequest）
      expect(authHookCalls).toHaveLength(1)
      expect(authHookCalls[0]).toContain('old-token')
      // 重试由 ky.retry 携带新 token 发起，最终成功（服务端仅对 new-token 返回成功）
      expect(result).toEqual({ id: 1, name: 'user' })
      expect(refreshed).toBe(true)
    })

    it('重试请求返回 401 不应该再次刷新', async () => {
      let refreshCount = 0
      const onUnauthorized = vi.fn()
      let tokenRefreshed = false

      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => tokenRefreshed ? 'new-token' : 'token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              refreshCount++
              tokenRefreshed = true
              return 'new-token'
            },
          },
        },
        onUnauthorized,
      })

      // 模拟：第一次 401，重试后仍然 401
      const [error, response] = await to(request.get('/always-401'))

      expect(refreshCount).toBe(1) // 只刷新一次
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
      // 应该返回 401 响应或抛出错误
      expect(error || (response as any)?.status === 401).toBeTruthy()
    })

    it('retry 请求不应包含任何内部标记 header', async () => {
      let refreshed = false
      const requestHeaders: string[][] = []

      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => refreshed ? 'new-token' : 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              refreshed = true
              return 'new-token'
            },
          },
        },
        extendedHooks: {
          beforeRequest: {
            append: [({ request }) => {
              const headers: string[] = []
              request.headers.forEach((value, key) => {
                headers.push(`${key}: ${value}`)
              })
              requestHeaders.push(headers)
            }],
          },
        },
      })

      await to(request.get('/error/http/401'))

      // 验证所有请求都不包含内部标记 header（如 X-Kk-Request-Retry）
      requestHeaders.forEach((headers) => {
        const hasInternalHeader = headers.some(h =>
          h.startsWith('X-Kk-Request-') || h.startsWith('x-kk-request-'),
        )
        expect(hasInternalHeader).toBe(false)
      })
    })

    it('连续 401 请求应各自完成一次刷新流程', async () => {
      let refreshCount = 0
      const onUnauthorized = vi.fn()

      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              refreshCount++
              return 'new-token'
            },
          },
        },
        onUnauthorized,
      })

      const [firstError] = await to(request.get('/error/http/401'))
      const [secondError] = await to(request.get('/error/http/401'))

      expect(isHTTPError(firstError)).toBe(true)
      expect(isHTTPError(secondError)).toBe(true)
      expect(refreshCount).toBe(2)
      expect(onUnauthorized).toHaveBeenCalledTimes(2)
    })

    it('pOST 请求 401 后应成功 retry（携带新 token 并保留原 body）', async () => {
      let refreshed = false

      const request = new Request({
        prefix: baseUrl,
        responseParser: { responseReturn: 'data' },
        auth: {
          getToken: () => refreshed ? 'new-token' : 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              refreshed = true
              return 'new-token'
            },
          },
        },
      })

      // 第一次 POST 用过期 token → 401 → 刷新 → ky.retry 携带新 token 与原 body 重发 → 成功
      const data = await request.post<{ id: number, name: string, received: unknown }>(
        '/auth/protected',
        { name: 'test' },
      )

      expect(refreshed).toBe(true)
      expect(data.id).toBe(1) // 重试成功并解包 data
      expect(data.received).toEqual({ name: 'test' }) // 原 body 在重试中完整保留
    })

    it('formData 上传请求 401 后也应能 retry（ky.retry 不再特殊跳过 FormData）', async () => {
      let refreshed = false

      const request = new Request({
        prefix: baseUrl,
        responseParser: { responseReturn: 'data' },
        auth: {
          getToken: () => refreshed ? 'new-token' : 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              refreshed = true
              return 'new-token'
            },
          },
        },
      })

      const formData = new FormData()
      formData.append('file', new Blob(['test']), 'test.txt')

      // 旧实现因 WeakMap 跳过 FormData 而无法 retry；新实现交给 ky.retry，应能刷新并重试成功
      const [error, data] = await to(request.post('/auth/protected', formData))

      expect(refreshed).toBe(true)
      expect(error).toBeNull()
      expect((data as any)?.id).toBe(1)
    })

    it('retry 成功后再次 401 应能再次刷新', async () => {
      let refreshCount = 0
      let tokenRefreshed = false

      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => tokenRefreshed ? 'new-token' : 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              refreshCount++
              tokenRefreshed = true
              return 'new-token'
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

      // 第一次请求：401 → refresh → retry 成功
      await request.get('/auth/protected')
      expect(refreshCount).toBe(1)

      // 模拟 token 再次过期
      tokenRefreshed = false

      // 第二次请求：应该能再次触发 refresh
      await request.get('/auth/protected')
      expect(refreshCount).toBe(2)
    })

    it('完全相同的并发请求应该都能成功', async () => {
      let refreshCount = 0
      let tokenRefreshed = false

      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => tokenRefreshed ? 'new-token' : 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              refreshCount++
              await new Promise(resolve => setTimeout(resolve, 100))
              tokenRefreshed = true
              return 'new-token'
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

      // 同时发起 3 个完全相同的请求
      const results = await Promise.all([
        request.get('/auth/protected'),
        request.get('/auth/protected'),
        request.get('/auth/protected'),
      ])

      // 验证所有请求都成功
      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result).toEqual({ id: 1, name: 'user' })
      })

      // 验证只刷新了一次
      expect(refreshCount).toBe(1)
    })

    it('onRefreshSuccess 抛错不应影响 retry', async () => {
      let tokenRefreshed = false
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onRefreshSuccess = vi.fn(() => {
        throw new Error('Callback error')
      })

      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => tokenRefreshed ? 'new-token' : 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              tokenRefreshed = true
              return 'new-token'
            },
            onRefreshSuccess,
          },
        },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
        },
      })

      // 验证即使回调抛错，retry 仍然成功
      const result = await request.get('/auth/protected')
      expect(result).toEqual({ id: 1, name: 'user' })
      expect(onRefreshSuccess).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[kk-request] onRefreshSuccess callback error:',
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })

    it('onRefreshFail 抛错不应影响错误传播', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onRefreshFail = vi.fn(() => {
        throw new Error('Callback error')
      })

      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              throw new Error('Refresh failed')
            },
            onRefreshFail,
          },
        },
      })

      // 验证即使回调抛错，主流程仍然正常
      const [error] = await to(request.get('/error/http/401'))
      expect(error).toBeDefined()
      expect(onRefreshFail).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[kk-request] onRefreshFail callback error:',
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })

    it('onUnauthorized 抛错应被隔离（retry 场景）', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onUnauthorized = vi.fn(() => {
        throw new Error('Callback error')
      })
      let tokenRefreshed = false

      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => tokenRefreshed ? 'new-token' : 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              tokenRefreshed = true
              return 'new-token'
            },
          },
        },
        onUnauthorized,
      })

      // 模拟：第一次 401，重试后仍然 401
      await to(request.get('/always-401'))

      expect(onUnauthorized).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[kk-request] onUnauthorized callback error:',
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })

    it('onUnauthorized 抛错应被隔离（无 auth 场景）', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onUnauthorized = vi.fn(() => {
        throw new Error('Callback error')
      })

      const request = new Request({
        prefix: baseUrl,
        onUnauthorized,
      })

      // 验证即使回调抛错，请求仍然正常返回 401
      const [error] = await to(request.get('/error/http/401'))
      expect(error).toBeDefined()
      expect(onUnauthorized).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[kk-request] onUnauthorized callback error:',
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })

    it('onUnauthorized 抛错应被隔离（refresh 失败场景）', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onUnauthorized = vi.fn(() => {
        throw new Error('Callback error')
      })

      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => 'expired-token',
          refreshToken: {
            getRefreshToken: () => 'refresh-token',
            refresh: async () => {
              throw new Error('Refresh failed')
            },
          },
        },
        onUnauthorized,
      })

      await to(request.get('/error/http/401'))

      expect(onUnauthorized).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[kk-request] onUnauthorized callback error:',
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })
  })
})
