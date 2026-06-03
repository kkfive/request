import type { EchoData } from '../../types'
import { beforeAll, describe, expect, it } from 'vitest'
import { Request } from '../../../src'

import { getBaseUrl } from '../helpers'

describe('request 认证与 headers', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = getBaseUrl()
  })

  describe('auth 配置', () => {
    it('getToken 同步返回 token 时应注入 Bearer token', async () => {
      const request = new Request({
        prefix: baseUrl,
        auth: { getToken: () => 'sync-token' },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<EchoData>('/auth/check')
      expect(result.authorization).toBe('Bearer sync-token')
    })

    it('getToken 异步返回 token 时应注入 Bearer token', async () => {
      const request = new Request({
        prefix: baseUrl,
        auth: { getToken: async () => 'async-token' },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<EchoData>('/auth/check')
      expect(result.authorization).toBe('Bearer async-token')
    })

    it('getToken 返回 null 时不应添加 Authorization header', async () => {
      const request = new Request({
        prefix: baseUrl,
        auth: { getToken: () => null },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<EchoData>('/auth/check')
      expect(result.authorization).toBeNull()
    })

    it('getToken 返回 Promise<null> 时不应添加 Authorization header', async () => {
      const request = new Request({
        prefix: baseUrl,
        auth: { getToken: async () => null },
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<EchoData>('/auth/check')
      expect(result.authorization).toBeNull()
    })

    it('自定义 headerName 应使用指定的 header 名', async () => {
      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => 'custom-token',
          headerName: 'X-Auth-Token',
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

      const result = await request.get<EchoData>('/headers/check')
      expect(result.headers?.['x-auth-token']).toBe('Bearer custom-token')
    })

    it('scheme=Basic 应使用 Basic 前缀', async () => {
      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => 'basic-token',
          scheme: 'Basic',
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

      const result = await request.get<EchoData>('/auth/check')
      expect(result.authorization).toBe('Basic basic-token')
    })

    it('scheme=null 应不添加前缀', async () => {
      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => 'raw-token',
          scheme: null,
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

      const result = await request.get<EchoData>('/auth/check')
      expect(result.authorization).toBe('raw-token')
    })

    it('scheme 为空字符串应不添加前缀', async () => {
      const request = new Request({
        prefix: baseUrl,
        auth: {
          getToken: () => 'no-scheme-token',
          scheme: '',
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

      const result = await request.get<EchoData>('/auth/check')
      expect(result.authorization).toBe('no-scheme-token')
    })
  })

  describe('getHeaders 配置', () => {
    it('同步返回 headers 时应注入', async () => {
      const request = new Request({
        prefix: baseUrl,
        getHeaders: () => ({ 'X-Custom': 'sync-value' }),
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<EchoData>('/headers/check')
      expect(result.headers?.['x-custom']).toBe('sync-value')
    })

    it('异步返回 headers 时应注入', async () => {
      const request = new Request({
        prefix: baseUrl,
        getHeaders: async () => ({ 'X-Async': 'async-value' }),
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<EchoData>('/headers/check')
      expect(result.headers?.['x-async']).toBe('async-value')
    })

    it('返回空值 header 时应被忽略', async () => {
      const request = new Request({
        prefix: baseUrl,
        getHeaders: () => ({ 'X-Empty': '', 'X-Valid': 'value' }),
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get<EchoData>('/headers/check')
      expect(result.headers?.['x-empty']).toBeUndefined()
      expect(result.headers?.['x-valid']).toBe('value')
    })

    it('返回空对象时应正常工作', async () => {
      const request = new Request({
        prefix: baseUrl,
        getHeaders: () => ({}),
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
      // 验证返回的是 /success 端点的 data 字段内容（随机字符串）
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
