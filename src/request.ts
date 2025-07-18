import type { KyInstance } from 'ky'
import type { RequestError } from './errors/app-error'
import type { RequestOption } from './type'
import ky, { HTTPError } from 'ky'
import { paramsSerializerHook } from './modules/params-serializer-hook'
import { createResponseParserHook } from './modules/response'
import { merge } from './utils/merge'

class Request {
  private readonly instance: KyInstance
  private readonly requestOption: RequestOption
  constructor(requestOption?: RequestOption) {
    // 合并默认配置和传入的配置
    const defaultConfig: RequestOption = {
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      timeout: 10_000,
    }
    const requestConfig = merge(defaultConfig, requestOption || {})

    // 强制保证 hooks.beforeRequest 存在并顺序正确
    requestConfig.hooks ??= {}
    requestConfig.hooks.beforeRequest = [
      paramsSerializerHook,
      ...(requestConfig.hooks.beforeRequest ?? []),
    ]

    // 插入 response 解析 hook（如果提供）
    if (requestOption?.responseParser) {
      requestConfig.hooks.afterResponse = [
        createResponseParserHook(),
        ...(requestConfig.hooks.afterResponse ?? []),
      ]
    }

    this.instance = ky.create(requestConfig)
    this.requestOption = requestConfig
  }

  /**
   * DELETE请求方法
   */
  public delete<T = any>(url: string, config?: RequestOption): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' })
  }

  /**
   * GET请求方法
   */
  public get<T = any>(url: string, config?: RequestOption): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' })
  }

  /**
   * PATCH请求方法
   */
  public patch<T = any>(url: string, data?: unknown, config?: RequestOption): Promise<T> {
    return this.request<T>(url, { ...config, json: data, method: 'PATCH' })
  }

  /**
   * POST请求方法
   */
  public post<T = any>(url: string, data?: unknown, config?: RequestOption): Promise<T> {
    return this.request<T>(url, { ...config, json: data, method: 'POST' })
  }

  /**
   * PUT请求方法
   */
  public put<T = any>(url: string, data?: unknown, config?: RequestOption): Promise<T> {
    return this.request<T>(url, { ...config, json: data, method: 'PUT' })
  }

  /**
   * 通用的请求方法
   */
  public async request<T>(url: string, config: RequestOption): Promise<T> {
    const responseReturn = this.requestOption?.responseParser?.responseReturn === 'raw' || config.responseParser?.responseReturn === 'raw'
    const prefixUrl = config.prefixUrl || this.requestOption.prefixUrl
    if (prefixUrl) {
      // 去除url开头的斜杠
      url = url.startsWith('/') ? url.slice(1) : url
    }
    try {
      const response = await this.instance(url, config)

      if (responseReturn) {
        return response as T
      }
      return await response.json() as T
    }
    catch (error: unknown) {
      const makeErrorMessage = config.makeErrorMessage || this.requestOption.makeErrorMessage

      if (error instanceof HTTPError) {
        // 这是 ky 抛出的 HTTP 错误 (如 404, 500)
        // 你可以从 error.response 中获取到 Response 对象
        const _error = error as HTTPError
        Object.defineProperty(_error, 'isBusinessError', { value: false, writable: false, configurable: false })
        makeErrorMessage?.(_error.message, _error as any)
      }
      else if (error instanceof Error) {
        // 其他类型的错误 (如超时、网络问题)
        const makeErrorMessage = config.makeErrorMessage || this.requestOption.makeErrorMessage
        // 对于非 HTTPError，可能没有 _error.response
        makeErrorMessage?.(error.message, error as RequestError)
      }
      throw error
    }
  }
}
export { Request }
