import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Request, RequestError, to } from '../src'

declare global {
  // eslint-disable-next-line vars-on-top, no-var
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
      const request = new Request({ prefixUrl: baseUrl })
      expect(request.raw).toBeDefined()
      expect(typeof request.raw).toBe('function')
    })
  })

  describe('hTTP 方法', () => {
    let request: Request

    beforeAll(() => {
      request = new Request({
        prefixUrl: baseUrl,
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
      const result = await request.get('/echo')
      expect(result.method).toBe('GET')
    })

    it('pOST 请求应发送 JSON 数据', async () => {
      const result = await request.post('/echo', { name: 'test', value: 123 })
      expect(result.method).toBe('POST')
      expect(result.body).toEqual({ name: 'test', value: 123 })
    })

    it('pOST 请求应正确处理 FormData', async () => {
      // 使用 Request 类的 post 方法测试 FormData
      const requestNoParser = new Request({
        prefixUrl: baseUrl,
      })

      const formData = new FormData()
      formData.append('field1', 'value1')
      formData.append('field2', 'value2')

      // 使用 post 方法发送 FormData
      const result = await requestNoParser.post('/formdata', formData)
      // 无 responseParser 时返回完整响应体
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.fields.field1).toBe('value1')
      expect(result.data.fields.field2).toBe('value2')
    })

    it('pOST 请求应正确处理空 FormData', async () => {
      // 使用 Request 类的 post 方法测试空 FormData
      const requestNoParser = new Request({
        prefixUrl: baseUrl,
      })

      const formData = new FormData()
      const result = await requestNoParser.post('/formdata', formData)
      // 验证空 FormData 也能正确处理
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(Object.keys(result.data.fields)).toHaveLength(0)
    })

    it('formData 请求无 hooks 配置时应正常工作', async () => {
      // 这个测试覆盖 request.ts line 188: finalConfig.hooks?.beforeRequest ?? []
      // 当 FormData 请求时 config 没有 hooks 配置
      const request = new Request({
        prefixUrl: baseUrl,
        // 不使用 responseParser，避免 unwrap 逻辑修改 finalConfig
      })

      const formData = new FormData()
      formData.append('test', 'value')

      // 直接调用 request 方法，不传入 hooks 配置
      // 这样 finalConfig.hooks 为 undefined，触发 ?? [] 分支
      const result = await request.request('/formdata', {
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
        prefixUrl: baseUrl,
      })

      const formData = new FormData()
      formData.append('test', 'value')

      const result = await request.request('/formdata', {
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
      const result = await request.put('/echo', { update: 'data' })
      expect(result.method).toBe('PUT')
      expect(result.body).toEqual({ update: 'data' })
    })

    it('pUT 请求应正确处理 FormData', async () => {
      // 使用 Request 类的 put 方法测试 FormData
      const requestNoParser = new Request({
        prefixUrl: baseUrl,
      })

      const formData = new FormData()
      formData.append('file', 'content')

      const result = await requestNoParser.put('/formdata', formData)
      // 无 responseParser 时返回完整响应体
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.fields.file).toBe('content')
    })

    it('pATCH 请求应发送 JSON 数据', async () => {
      const result = await request.patch('/echo', { patch: 'field' })
      expect(result.method).toBe('PATCH')
      expect(result.body).toEqual({ patch: 'field' })
    })

    it('pATCH 请求应正确处理 FormData', async () => {
      // 使用 Request 类的 patch 方法测试 FormData
      const requestNoParser = new Request({
        prefixUrl: baseUrl,
      })

      const formData = new FormData()
      formData.append('partial', 'update')

      const result = await requestNoParser.patch('/formdata', formData)
      // 无 responseParser 时返回完整响应体
      expect(result.success).toBe(true)
      expect(result.data.isMultipart).toBe(true)
      expect(result.data.fields.partial).toBe('update')
    })

    it('dELETE 请求应正常工作', async () => {
      const result = await request.delete('/echo')
      expect(result.method).toBe('DELETE')
    })

    it('dELETE 请求应支持 params', async () => {
      const result = await request.delete('/echo', { params: { id: '123' } })
      expect(result.method).toBe('DELETE')
      expect(result.query).toEqual({ id: '123' })
    })
  })

  describe('auth 配置', () => {
    it('getToken 同步返回 token 时应注入 Bearer token', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/auth/check')
      expect(result.authorization).toBe('Bearer sync-token')
    })

    it('getToken 异步返回 token 时应注入 Bearer token', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/auth/check')
      expect(result.authorization).toBe('Bearer async-token')
    })

    it('getToken 返回 null 时不应添加 Authorization header', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/auth/check')
      expect(result.authorization).toBeNull()
    })

    it('getToken 返回 Promise<null> 时不应添加 Authorization header', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/auth/check')
      expect(result.authorization).toBeNull()
    })

    it('自定义 headerName 应使用指定的 header 名', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/headers/check')
      expect(result.headers['x-auth-token']).toBe('Bearer custom-token')
    })

    it('scheme=Basic 应使用 Basic 前缀', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/auth/check')
      expect(result.authorization).toBe('Basic basic-token')
    })

    it('scheme=null 应不添加前缀', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/auth/check')
      expect(result.authorization).toBe('raw-token')
    })

    it('scheme 为空字符串应不添加前缀', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/auth/check')
      expect(result.authorization).toBe('no-scheme-token')
    })
  })

  describe('getHeaders 配置', () => {
    it('同步返回 headers 时应注入', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/headers/check')
      expect(result.headers['x-custom']).toBe('sync-value')
    })

    it('异步返回 headers 时应注入', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/headers/check')
      expect(result.headers['x-async']).toBe('async-value')
    })

    it('返回空值 header 时应被忽略', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/headers/check')
      expect(result.headers['x-empty']).toBeUndefined()
      expect(result.headers['x-valid']).toBe('value')
    })

    it('返回空对象时应正常工作', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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

      const result = await request.get('/success')
      // 验证返回的是 /success 端点的 data 字段内容（随机字符串）
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('unwrap 参数', () => {
    it('unwrap=true 且有实例 responseParser 时应返回 data 字段', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get('/success', { unwrap: true })
      // 验证返回的是 /success 端点的 data 字段内容（随机字符串）
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('unwrap=false 且有实例 responseParser 时应返回完整响应体', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get('/success', { unwrap: false })
      expect(result).toHaveProperty('success', true)
      // data 字段是随机字符串
      expect(result).toHaveProperty('data')
      expect(typeof result.data).toBe('string')
    })

    it('unwrap=true 但无实例 responseParser 时应被忽略', async () => {
      const request = new Request({ prefixUrl: baseUrl })

      const result = await request.get('/success', { unwrap: true })
      expect(typeof result).toBe('object')
      expect(result).toHaveProperty('success', true)
    })
  })

  describe('params 序列化', () => {
    let request: Request

    beforeAll(() => {
      request = new Request({
        prefixUrl: baseUrl,
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
      const result = await request.get('/params', {
        params: { ids: [1, 2, 3] },
      })
      expect(result.rawQuery).toBe('?ids=1%2C2%2C3')
    })

    it('brackets 模式应序列化为 ids[]=1&ids[]=2&ids[]=3', async () => {
      const result = await request.get('/params', {
        params: { ids: [1, 2, 3] },
        paramsSerializer: 'brackets',
      })
      expect(result.rawQuery).toBe('?ids%5B%5D=1&ids%5B%5D=2&ids%5B%5D=3')
    })

    it('indices 模式应序列化为 ids[0]=1&ids[1]=2&ids[2]=3', async () => {
      const result = await request.get('/params', {
        params: { ids: [1, 2, 3] },
        paramsSerializer: 'indices',
      })
      expect(result.rawQuery).toBe('?ids%5B0%5D=1&ids%5B1%5D=2&ids%5B2%5D=3')
    })

    it('repeat 模式应序列化为 ids=1&ids=2&ids=3', async () => {
      const result = await request.get('/params', {
        params: { ids: [1, 2, 3] },
        paramsSerializer: 'repeat',
      })
      expect(result.rawQuery).toBe('?ids=1&ids=2&ids=3')
    })

    it('无 params 时应无 query string', async () => {
      const result = await request.get('/params')
      expect(result.rawQuery).toBe('')
    })

    it('混合参数应正确序列化', async () => {
      const result = await request.get('/params', {
        params: { name: 'test', ids: [1, 2] },
      })
      expect(result.query.name).toBe('test')
    })
  })

  describe('生命周期回调', () => {
    it('onRequest 实例级应被调用', async () => {
      const onRequestFn = vi.fn()
      const request = new Request({
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
        onUnauthorized: onUnauthorizedFn,
      })

      await to(request.get('/error/http/401'))
      expect(onUnauthorizedFn).toHaveBeenCalled()
    })
  })

  describe('请求取消', () => {
    it('abortController.abort() 应取消请求', async () => {
      const request = new Request({ prefixUrl: baseUrl })
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
        prefixUrl: baseUrl,
        responseParser: { responseReturn: 'raw' },
      })

      const result = await request.get('/success')
      expect(result).toBeInstanceOf(Response)
    })

    it('responseReturn=body 成功响应应返回完整 JSON', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
        responseParser: { responseReturn: 'body' },
      })

      const result = await request.get('/success')
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('data')
    })

    it('responseReturn=body HTTP 错误应抛出 RequestError', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
        responseParser: { responseReturn: 'body' },
      })

      const [error] = await to(request.get('/error/http/500'))
      expect(error).toBeInstanceOf(RequestError)
    })

    it('dataField 为函数时应返回函数处理结果', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: (res: any) => ({ processed: res.data }),
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get('/success')
      expect(result).toHaveProperty('processed')
    })

    it('successCode 为数值时应正确判断', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'code',
          dataField: 'data',
          successCode: 0,
          errorCodeField: 'code',
          errorMessageField: 'msg',
        },
      })

      const result = await request.get('/custom-code')
      expect(result).toBe('custom code response')
    })

    it('successCode 为函数返回 false 时应抛出业务错误', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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
      expect(error).toBeInstanceOf(RequestError)
    })

    it('errorMessageField 为函数时应使用函数返回的消息', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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

    it('400 应返回请求参数错误', async () => {
      const [error] = await to(request.get('/error/http/400'))
      expect(error).toBeInstanceOf(RequestError)
      expect(error?.message).toBe('请求参数错误')
    })

    it('401 应返回未授权或登录已过期', async () => {
      const [error] = await to(request.get('/error/http/401'))
      expect(error).toBeInstanceOf(RequestError)
      expect(error?.message).toBe('未授权或登录已过期')
    })

    it('403 应返回没有权限访问该资源', async () => {
      const [error] = await to(request.get('/error/http/403'))
      expect(error).toBeInstanceOf(RequestError)
      expect(error?.message).toBe('没有权限访问该资源')
    })

    it('404 应返回请求的资源不存在', async () => {
      const [error] = await to(request.get('/error/http/404'))
      expect(error).toBeInstanceOf(RequestError)
      expect(error?.message).toBe('请求的资源不存在')
    })

    it('500 应返回服务器内部错误', async () => {
      const [error] = await to(request.get('/error/http/500'))
      expect(error).toBeInstanceOf(RequestError)
      expect(error?.message).toBe('服务器内部错误')
    })

    it('418 应返回网络错误状态码', async () => {
      const [error] = await to(request.get('/error/http/418'))
      expect(error).toBeInstanceOf(RequestError)
      expect(error?.message).toBe('网络错误，状态码：418')
    })
  })

  describe('uRL 处理', () => {
    it('prefixUrl + /开头 URL 应去除开头斜杠', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get('/success')
      expect(typeof result).toBe('string')
    })

    it('prefixUrl + 无斜杠 URL 应正常拼接', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get('success')
      expect(typeof result).toBe('string')
    })

    it('请求级 prefixUrl 应覆盖实例级', async () => {
      const request = new Request({
        prefixUrl: 'http://invalid-url',
        responseParser: {
          responseReturn: 'data',
          codeField: 'success',
          dataField: 'data',
          successCode: true,
          errorCodeField: 'errorCode',
          errorMessageField: 'errorMessage',
        },
      })

      const result = await request.get('/success', { prefixUrl: baseUrl })
      expect(typeof result).toBe('string')
    })
  })

  describe('错误处理', () => {
    it('业务错误应包含 isBusinessError=false', async () => {
      const request = new Request({
        prefixUrl: baseUrl,
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
      expect(error).toBeInstanceOf(RequestError)
      expect((error as RequestError).isBusinessError).toBe(false)
    })

    it('makeErrorMessage 实例级应被调用', async () => {
      const makeErrorMessageFn = vi.fn()
      const request = new Request({
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
      const instanceHook = vi.fn((_req: any, _opt: any, res: Response) => res)
      const requestHook = vi.fn((_req: any, _opt: any, res: Response) => res)

      const request = new Request({
        prefixUrl: baseUrl,
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
  })

  describe('hTTPError 分支覆盖', () => {
    it('无 responseParser 时 HTTP 错误应触发 HTTPError 分支', async () => {
      const onResponseFn = vi.fn()
      const onErrorFn = vi.fn()
      const makeErrorMessageFn = vi.fn()

      const request = new Request({
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
        prefixUrl: baseUrl,
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
      expect(error).toBeInstanceOf(RequestError)
      // 由于 /error/business/500 返回的是 errorMessage 字段，而默认是 message
      // 所以会回退到 msg 字段或默认消息 '接口响应失败'
      expect(error?.message).toBe('接口响应失败')
    })

    it('responseParser 未定义时 hook 应使用默认值', async () => {
      // 这个测试覆盖 response.ts line 137: responseReturnConfig ?? {}
      // 当 responseParser 被设置但 responseReturnConfig 为 undefined 时
      const request = new Request({
        prefixUrl: baseUrl,
        responseParser: {
          responseReturn: 'raw',
        },
      })

      // raw 模式下直接返回 Response，不会解析 responseReturnConfig
      const result = await request.get('/success')
      expect(result).toBeInstanceOf(Response)
    })

    it('无 prefixUrl 时应直接使用 url', async () => {
      const request = new Request({
        // 不设置 prefixUrl
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
        prefixUrl: baseUrl,
        onRequest: onRequestFn,
      })

      await request.request('/success', {})
      expect(onRequestFn).toHaveBeenCalledWith('GET', expect.stringContaining('success'))
    })
  })
})
