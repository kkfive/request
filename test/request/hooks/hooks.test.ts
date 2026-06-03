import type { EchoData, FormDataResponse } from '../../types'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Request, to } from '../../../src'

import { getBaseUrl } from '../helpers'

describe('request hooks 管理', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = getBaseUrl()
  })

  describe('hooks 合并', () => {
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
