import type { HTTPError } from '../src'
import type { EchoData, FormDataResponse } from './types'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { BusinessError, isHTTPError, Request, to } from '../src'

declare global {
  // eslint-disable-next-line vars-on-top
  var __TEST_SERVER_URL__: string
}

describe('request 核心功能测试', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = globalThis.__TEST_SERVER_URL__
  })

  describe('静态方法和属性', () => {
    it('createAbortController 应返回 AbortController 实例', () => {
      const controller = Request.createAbortController()
      expect(controller).toBeInstanceOf(AbortController)
      expect(typeof controller.abort).toBe('function')
      expect(controller.signal).toBeInstanceOf(AbortSignal)
    })

    it('raw getter 应返回 ky 实例', () => {
      const request = new Request({ prefix: baseUrl })
      expect(request.raw).toBeDefined()
      expect(typeof request.raw).toBe('function')
    })
  })

  describe('hTTP 方法', () => {
    let request: Request

    beforeAll(() => {
      request = new Request({
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
    })

    it('gET 请求应正常工作', async () => {
      const result = await request.get<EchoData>('/echo')
      expect(result.method).toBe('GET')
    })

    it('pOST 请求应发送 JSON 数据', async () => {
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

    it('formData 请求无 hooks 配置时应正常工作', async () => {
      // 这个测试覆盖 request.ts line 188: finalConfig.hooks?.beforeRequest ?? []
      // 当 FormData 请求时 config 没有 hooks 配置
      const request = new Request({
        prefix: baseUrl,
        // 不使用 responseParser，避免 unwrap 逻辑修改 finalConfig
      })

      const formData = new FormData()
      formData.append('test', 'value')

      // 直接调用 request 方法，不传入 hooks 配置
      // 这样 finalConfig.hooks 为 undefined，触发 ?? [] 分支
      const result = await request.request<FormDataResponse>('/formdata', {
        method: 'POST',
        body: formData,
        // 不传入 hooks
      })
      // 无 responseParser 时返回完整响应体
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.fields.test).toBe('value')
    })

    it('formData 请求有 hooks 但无 beforeRequest 时应正常工作', async () => {
      // 这个测试覆盖 request.ts line 188 的另一个分支
      // 当 FormData 请求时 config.hooks 存在但 beforeRequest 为 undefined
      const request = new Request({
        prefix: baseUrl,
      })

      const formData = new FormData()
      formData.append('test', 'value')

      const result = await request.request<FormDataResponse>('/formdata', {
        method: 'POST',
        body: formData,
        hooks: {
          // 只有 afterResponse，没有 beforeRequest
          afterResponse: [],
        },
      })
      // 无 responseParser 时返回完整响应体
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.fields.test).toBe('value')
    })

    it('pUT 请求应发送 JSON 数据', async () => {
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
      const result = await request.delete<EchoData>('/echo')
      expect(result.method).toBe('DELETE')
    })

    it('dELETE 请求应支持 params', async () => {
      const result = await request.delete<EchoData>('/echo', { params: { id: '123' } })
      expect(result.method).toBe('DELETE')
      expect(result.query).toEqual({ id: '123' })
    })
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

  describe('params 序列化', () => {
    let request: Request

    beforeAll(() => {
      request = new Request({
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
    })

    it('默认 comma 模式应序列化为 ids=1,2,3', async () => {
      const result = await request.get<EchoData>('/params', {
        params: { ids: [1, 2, 3] },
      })
      expect(result.rawQuery).toBe('?ids=1%2C2%2C3')
    })

    it('brackets 模式应序列化为 ids[]=1&ids[]=2&ids[]=3', async () => {
      const result = await request.get<EchoData>('/params', {
        params: { ids: [1, 2, 3] },
        paramsSerializer: 'brackets',
      })
      expect(result.rawQuery).toBe('?ids%5B%5D=1&ids%5B%5D=2&ids%5B%5D=3')
    })

    it('indices 模式应序列化为 ids[0]=1&ids[1]=2&ids[2]=3', async () => {
      const result = await request.get<EchoData>('/params', {
        params: { ids: [1, 2, 3] },
        paramsSerializer: 'indices',
      })
      expect(result.rawQuery).toBe('?ids%5B0%5D=1&ids%5B1%5D=2&ids%5B2%5D=3')
    })

    it('repeat 模式应序列化为 ids=1&ids=2&ids=3', async () => {
      const result = await request.get<EchoData>('/params', {
        params: { ids: [1, 2, 3] },
        paramsSerializer: 'repeat',
      })
      expect(result.rawQuery).toBe('?ids=1&ids=2&ids=3')
    })

    it('无 params 时应无 query string', async () => {
      const result = await request.get<EchoData>('/params')
      expect(result.rawQuery).toBe('')
    })

    it('混合参数应正确序列化', async () => {
      const result = await request.get<EchoData>('/params', {
        params: { name: 'test', ids: [1, 2] },
      })
      expect(result.query?.name).toBe('test')
    })
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
      expect(requestFn).toHaveBeenCalled()
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

      await to(request.get('/error/http/500'))
      expect(onErrorFn).toHaveBeenCalled()
      // 第一个参数是 error，第二个参数是 response
      const [errorArg, responseArg] = onErrorFn.mock.calls[0]
      expect(errorArg).toBeDefined()
      expect(responseArg).toBeInstanceOf(Response)
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
      expect(requestFn).toHaveBeenCalled()
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
      expect(onUnauthorizedFn).toHaveBeenCalled()
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
      expect(onUnauthorizedFn).toHaveBeenCalled()
    })
  })

  describe('请求取消', () => {
    it('abortController.abort() 应取消请求', async () => {
      const request = new Request({ prefix: baseUrl })
      const controller = Request.createAbortController()

      setTimeout(() => controller.abort(), 10)

      const [error] = await to(request.get('/timeout', { signal: controller.signal }))
      expect(error).toBeDefined()
      expect(error?.name).toBe('AbortError')
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
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('data')
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
    let request: Request

    beforeAll(() => {
      request = new Request({
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
    })

    it('400 应以 ky HTTPError 抛出', async () => {
      const [error] = await to(request.get('/error/http/400'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(400)
    })

    it('401 应以 ky HTTPError 抛出', async () => {
      const [error] = await to(request.get('/error/http/401'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(401)
    })

    it('403 应以 ky HTTPError 抛出', async () => {
      const [error] = await to(request.get('/error/http/403'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(403)
    })

    it('404 应以 ky HTTPError 抛出', async () => {
      const [error] = await to(request.get('/error/http/404'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(404)
    })

    it('500 应以 ky HTTPError 抛出', async () => {
      const [error] = await to(request.get('/error/http/500'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(500)
    })

    it('418 应以 ky HTTPError 抛出', async () => {
      const [error] = await to(request.get('/error/http/418'))
      expect(isHTTPError(error)).toBe(true)
      expect((error as HTTPError).response.status).toBe(418)
    })
  })

  describe('uRL 处理', () => {
    it('prefix + /开头 URL 应去除开头斜杠', async () => {
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

      const result = await request.get<string>('/success')
      expect(typeof result).toBe('string')
    })

    it('prefix + 无斜杠 URL 应正常拼接', async () => {
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

      const result = await request.get<string>('success')
      expect(typeof result).toBe('string')
    })

    it('请求级 prefix 应覆盖实例级', async () => {
      const request = new Request({
        prefix: 'http://invalid-url',
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
      expect(typeof result).toBe('string')
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
      expect(makeErrorMessageFn).toHaveBeenCalled()
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
      expect(requestFn).toHaveBeenCalled()
    })
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

      expect(instanceHook).toHaveBeenCalled()
      expect(requestHook).toHaveBeenCalled()
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

      // 验证两个 hook 都被调用
      expect(beforeHook1).toHaveBeenCalled()
      expect(beforeHook2).toHaveBeenCalled()
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

      // 验证返回完整响应体而非解析后的 data 字段
      // 因为 responseParser hook 被禁用，所以返回原始 JSON
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('data')
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

      // 验证请求正常工作
      const result = await request.get<string>('/success')
      expect(typeof result).toBe('string')
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

      // 验证两个 hook 都被调用
      expect(prependHook).toHaveBeenCalled()
      expect(appendHook).toHaveBeenCalled()
    })

    it('extendedHooks 对象形式只有 prepend 应正确处理', async () => {
      const prependHook = vi.fn()

      const request = new Request({
        prefix: baseUrl,
        extendedHooks: {
          beforeRequest: {
            prepend: [prependHook],
            // 没有 append，测试 registry.ts:23 行
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

      // 验证 hook 被调用
      expect(prependHook).toHaveBeenCalled()
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

      // 验证自定义 hook 被调用，而不是内置 auth hook
      expect(customAuthHook).toHaveBeenCalled()
    })
  })

  describe('hTTPError 分支覆盖', () => {
    it('无 responseParser 时 HTTP 错误应触发 HTTPError 分支', async () => {
      const onResponseFn = vi.fn()
      const onErrorFn = vi.fn()
      const makeErrorMessageFn = vi.fn()

      const request = new Request({
        prefix: baseUrl,
        onResponse: onResponseFn,
        onError: onErrorFn,
        makeErrorMessage: makeErrorMessageFn,
        // 不使用 responseParser，让 HTTPError 直接抛出
      })

      await to(request.get('/error/http/500'))

      expect(onResponseFn).toHaveBeenCalledWith('GET', expect.stringContaining('error/http/500'), 500)
      expect(onErrorFn).toHaveBeenCalled()
      expect(makeErrorMessageFn).toHaveBeenCalled()
    })

    it('网络错误应触发普通 Error 分支', async () => {
      const onErrorFn = vi.fn()
      const makeErrorMessageFn = vi.fn()

      const request = new Request({
        prefix: baseUrl,
        onError: onErrorFn,
        makeErrorMessage: makeErrorMessageFn,
        timeout: 100, // 设置很短的超时
      })

      // 请求 /timeout 端点会触发超时错误
      const [error] = await to(request.get('/timeout'))

      expect(error).toBeDefined()
      expect(onErrorFn).toHaveBeenCalled()
      expect(makeErrorMessageFn).toHaveBeenCalled()
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

    it('responseParser 未定义时 hook 应使用默认值', async () => {
      // 这个测试覆盖 response.ts line 137: responseReturnConfig ?? {}
      // 当 responseParser 被设置但 responseReturnConfig 为 undefined 时
      const request = new Request({
        prefix: baseUrl,
        responseParser: {
          responseReturn: 'raw',
        },
      })

      // raw 模式下直接返回 Response，不会解析 responseReturnConfig
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
      expect(onUnauthorized).toHaveBeenCalled() // 触发 onUnauthorized
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

    it('快速连续的相同请求应正确处理', async () => {
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
              await new Promise(resolve => setTimeout(resolve, 100))
              return 'new-token'
            },
          },
        },
        onUnauthorized,
      })

      // 快速连续发送相同请求
      await to(request.get('/error/http/401'))
      await new Promise(resolve => setTimeout(resolve, 50))
      await to(request.get('/error/http/401'))

      // 第一个请求触发 refresh，第二个请求因为 token 已刷新，不会再触发 refresh
      // 但第二个请求仍然返回 401（因为服务端总是返回 401），所以会再次尝试 refresh
      expect(refreshCount).toBeGreaterThanOrEqual(1)
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
