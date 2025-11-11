import process from 'node:process'
import { to } from '@esdora/kit'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Request, RequestError } from '../src'

describe('request Library Tests', () => {
  let afterResponseFn: ReturnType<typeof vi.fn>
  let makeErrorMessageFn: ReturnType<typeof vi.fn>
  let request: Request
  let mockServerUrl: string

  beforeAll(() => {
    // 从环境变量获取 mock 服务器 URL
    mockServerUrl = process.env.MOCK_SERVER_URL || 'http://localhost:3456'
  })

  beforeEach(() => {
    // 在每个测试前重新创建 mock 函数和 Request 实例
    afterResponseFn = vi.fn()
    makeErrorMessageFn = vi.fn() as any

    request = new Request({
      prefixUrl: mockServerUrl,
      makeErrorMessage: makeErrorMessageFn as any,
      responseParser: {
        responseReturn: 'data',
        dataField: 'data',
        errorMessageField: 'errorMessage',
        errorCodeField: 'errorCode',
        // 自定义判断状态码的字段
        codeField: 'success',
        // 自定义判断状态码逻辑（例如success字段为true则表示成功；code字段为0则表示成功）
        successCode: code => code === true,
      },
      hooks: {
        afterResponse: [
          (request, options, response) => {
            ;(afterResponseFn as any)()
            return response
          },
        ],
      },
    })
  })
  describe('request Class', () => {
    it('判断是否包含请求方法', () => {
      expect(request).toBeInstanceOf(Request)
      expect(typeof request.get).toBe('function')
      expect(typeof request.post).toBe('function')
      expect(typeof request.put).toBe('function')
      expect(typeof request.patch).toBe('function')
      expect(typeof request.delete).toBe('function')
    })
  })
  describe('正常请求', () => {
    const mockRequest = { success: '/success' }

    it('正常请求(返回data数据)', async () => {
      const [error, result] = await to(request.get(mockRequest.success))
      expect(error).toBeNull()
      // result 为字符串
      expect(typeof result).toBe('string')
    })

    it('正常请求(返回body数据)', async () => {
      const [error, result] = await to(request.get(mockRequest.success, {
        responseParser: {
          responseReturn: 'body',
        },
      }))
      expect(error).toBeNull()
      // result为{ success:true, data: '随机字符串' }
      // 判断result是否为对象
      expect(typeof result).toBe('object')
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('data')
      // 判断data是否为字符串
      expect(typeof result.data).toBe('string')
    })

    it('正常请求(返回原始数据)', async () => {
      const [error, result] = await to(request.get(mockRequest.success, {
        responseParser: {
          responseReturn: 'raw',
        },
      }))
      expect(error).toBeNull()
      expect(result).toBeInstanceOf(Response)
    })

    it('正常请求，传入afterResponse', async () => {
      const localAfterResponseFn = vi.fn()
      await request.get(mockRequest.success, {
        hooks: { afterResponse: [localAfterResponseFn] },
      })
      // 初始化时传入的afterResponse应该执行
      expect(afterResponseFn).toHaveBeenCalled()
      // 传入的afterResponse也应该执行
      expect(localAfterResponseFn).toHaveBeenCalled()
    })
  })

  describe('异常请求', () => {
    const mockRequest = {
      businessError: '/error/business/500',
      networkError: '/error/http/500',
    }

    it('业务错误', async () => {
      // 业务错误指 HTTP状态码为2xx，但业务code不为成功状态码
      const [error, result] = await to(request.get(mockRequest.businessError))
      expect(error).toBeInstanceOf(RequestError)

      expect(result).toBeUndefined()
    })
    it('网络错误', async () => {
      const [error, result] = await to(request.get(mockRequest.networkError))
      expect(error).toBeInstanceOf(RequestError)
      expect(result).toBeUndefined()
    })
    it('错误消息处理(应用全局错误处理器)', async () => {
      const [error, result] = await to(request.get(mockRequest.businessError))
      expect(result).toBeUndefined()
      // makeErrorMessageFn应该被调用
      expect(makeErrorMessageFn).toHaveBeenCalled()
      // 传入makeErrorMessageFn的参数
      expect(makeErrorMessageFn).toHaveBeenCalledWith(error?.message, error as RequestError)
    })
    it('错误消息处理(自定义错误处理器)', async () => {
      const localMakeErrorMessageFn = vi.fn()
      const [error, result] = await to(request.get(mockRequest.businessError, {
        makeErrorMessage: localMakeErrorMessageFn,
      }))
      expect(result).toBeUndefined()
      // 全局的makeErrorMessageFn不应该被调用
      expect(makeErrorMessageFn).not.toHaveBeenCalled()
      // localMakeErrorMessageFn 应该被调用
      expect(localMakeErrorMessageFn).toHaveBeenCalled()
      // 传入localMakeErrorMessageFn的参数
      expect(localMakeErrorMessageFn).toHaveBeenCalledWith(error?.message, error as RequestError)
    })
  })
})
