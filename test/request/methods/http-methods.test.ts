import type { EchoData, FormDataResponse } from '../../types'
import { beforeAll, describe, expect, it } from 'vitest'
import { Request } from '../../../src'

import { getBaseUrl } from '../helpers'

describe('request HTTP 方法', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = getBaseUrl()
  })

  describe('hTTP 方法', () => {
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

    it('gET 请求应正常工作', async () => {
      const request = createParsedRequest()
      const result = await request.get<EchoData>('/echo')
      expect(result.method).toBe('GET')
    })

    it('pOST 请求应发送 JSON 数据', async () => {
      const request = createParsedRequest()
      const result = await request.post<EchoData>('/echo', { name: 'test', value: 123 })
      expect(result.method).toBe('POST')
      expect(result.body).toEqual({ name: 'test', value: 123 })
    })

    it('pOST 请求应正确处理 FormData', async () => {
      // 使用 Request 类的 post 方法测试 FormData
      const requestNoParser = new Request({
        prefix: baseUrl,
      })

      const formData = new FormData()
      formData.append('field1', 'value1')
      formData.append('field2', 'value2')

      // 使用 post 方法发送 FormData
      const result = await requestNoParser.post<FormDataResponse>('/formdata', formData)
      // 无 responseParser 时返回完整响应体
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.fields.field1).toBe('value1')
      expect(result.data.fields.field2).toBe('value2')
    })

    it('pOST 请求应正确处理空 FormData', async () => {
      // 使用 Request 类的 post 方法测试空 FormData
      const requestNoParser = new Request({
        prefix: baseUrl,
      })

      const formData = new FormData()
      const result = await requestNoParser.post<FormDataResponse>('/formdata', formData)
      // 验证空 FormData 也能正确处理
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(Object.keys(result.data.fields)).toHaveLength(0)
    })

    it('request() 发送 FormData 时不要求显式 hooks 配置', async () => {
      const request = new Request({
        prefix: baseUrl,
      })

      const formData = new FormData()
      formData.append('test', 'value')

      const result = await request.request<FormDataResponse>('/formdata', {
        method: 'POST',
        body: formData,
      })
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.fields.test).toBe('value')
    })

    it('request() 发送 FormData 时允许 hooks 缺省 beforeRequest', async () => {
      const request = new Request({
        prefix: baseUrl,
      })

      const formData = new FormData()
      formData.append('test', 'value')

      const result = await request.request<FormDataResponse>('/formdata', {
        method: 'POST',
        body: formData,
        hooks: {
          afterResponse: [],
        },
      })
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.fields.test).toBe('value')
    })

    it('pUT 请求应发送 JSON 数据', async () => {
      const request = createParsedRequest()
      const result = await request.put<EchoData>('/echo', { update: 'data' })
      expect(result.method).toBe('PUT')
      expect(result.body).toEqual({ update: 'data' })
    })

    it('pUT 请求应正确处理 FormData', async () => {
      // 使用 Request 类的 put 方法测试 FormData
      const requestNoParser = new Request({
        prefix: baseUrl,
      })

      const formData = new FormData()
      formData.append('file', 'content')

      const result = await requestNoParser.put<FormDataResponse>('/formdata', formData)
      // 无 responseParser 时返回完整响应体
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.fields.file).toBe('content')
    })

    it('pATCH 请求应发送 JSON 数据', async () => {
      const request = createParsedRequest()
      const result = await request.patch<EchoData>('/echo', { patch: 'field' })
      expect(result.method).toBe('PATCH')
      expect(result.body).toEqual({ patch: 'field' })
    })

    it('pATCH 请求应正确处理 FormData', async () => {
      // 使用 Request 类的 patch 方法测试 FormData
      const requestNoParser = new Request({
        prefix: baseUrl,
      })

      const formData = new FormData()
      formData.append('partial', 'update')

      const result = await requestNoParser.patch<FormDataResponse>('/formdata', formData)
      // 无 responseParser 时返回完整响应体
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.fields.partial).toBe('update')
    })

    it('dELETE 请求应正常工作', async () => {
      const request = createParsedRequest()
      const result = await request.delete<EchoData>('/echo')
      expect(result.method).toBe('DELETE')
    })

    it('dELETE 请求应支持 params', async () => {
      const request = createParsedRequest()
      const result = await request.delete<EchoData>('/echo', { params: { id: '123' } })
      expect(result.method).toBe('DELETE')
      expect(result.query).toEqual({ id: '123' })
    })
  })
})
