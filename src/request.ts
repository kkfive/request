import type { KyInstance } from 'ky'
import type { RequestOption } from './type'
import ky, { HTTPError } from 'ky'
import { RequestError } from './errors/app-error'
import { paramsSerializerHook } from './modules/params-serializer-hook'
import { createResponseParserHook } from './modules/response'
import { merge } from './utils/merge'

class Request {
  private readonly instance: KyInstance
  private readonly requestOption: RequestOption
  constructor(requestOption?: RequestOption) {
    const defaultConfig: RequestOption = {
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      timeout: 10_000,
    }

    const requestConfig = merge(
      merge({}, defaultConfig),
      requestOption || {},
    )

    requestConfig.hooks ??= {}
    requestConfig.hooks.beforeRequest = [
      paramsSerializerHook,
      ...(requestConfig.hooks.beforeRequest ?? []),
    ]

    this.instance = ky.create(requestConfig)
    this.requestOption = requestConfig
  }

  /**
   * DELETE请求方法
   */
  public delete<T = any>(url: string, data?: unknown, config?: RequestOption): Promise<T> {
    return this.request<T>(url, { ...config, json: data, method: 'DELETE' })
  }

  /**
   * GET请求方法
   */
  public get<T = any>(url: string, config?: RequestOption): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' })
  }

  /**
   * HEAD请求方法
   */
  public head(url: string, config?: RequestOption): Promise<Response> {
    return this.request<Response>(url, {
      ...config,
      method: 'HEAD',
      responseParser: { responseReturn: 'raw' },
    })
  }

  /**
   * OPTIONS请求方法
   */
  public options(url: string, config?: RequestOption): Promise<Response> {
    return this.request<Response>(url, {
      ...config,
      method: 'OPTIONS',
      responseParser: { responseReturn: 'raw' },
    })
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
  public async request<T>(url: string, config?: RequestOption): Promise<T> {
    const perRequestConfig: RequestOption = merge({}, config || {})
    const prefixUrl = perRequestConfig.prefixUrl !== undefined
      ? perRequestConfig.prefixUrl
      : this.requestOption.prefixUrl

    if (prefixUrl !== undefined) {
      perRequestConfig.prefixUrl = prefixUrl
      url = url.startsWith('/') ? url.slice(1) : url
    }

    const mergedConfig = merge(
      merge({}, this.requestOption),
      perRequestConfig,
    )

    const responseParserConfig = mergedConfig.responseParser
    const shouldInjectParser = Boolean(
      responseParserConfig
      && responseParserConfig.responseReturn
      && responseParserConfig.responseReturn !== 'raw',
    )

    if (shouldInjectParser) {
      const responseParserHook = createResponseParserHook()

      perRequestConfig.hooks ??= {}
      perRequestConfig.hooks.afterResponse = [
        ...(perRequestConfig.hooks.afterResponse ?? []),
        responseParserHook,
      ]

      mergedConfig.hooks ??= {}
      mergedConfig.hooks.afterResponse = [
        ...(mergedConfig.hooks.afterResponse ?? []),
        responseParserHook,
      ]
    }

    const responseReturn = mergedConfig.responseParser?.responseReturn ?? 'raw'

    try {
      const response = await this.instance(url, perRequestConfig)

      if (responseReturn === 'raw') {
        return response as T
      }
      return await response.json() as T
    }
    catch (error: unknown) {
      // 如果配置了 responseParser，将 HTTPError 转换为 RequestError
      if (mergedConfig.responseParser && error instanceof HTTPError) {
        const response = error.response
        const { message, code } = this.formatNetworkError(response)

        // 尝试解析错误响应体
        let raw: any = {}
        try {
          const contentType = response.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            raw = await response.json()
          }
          else {
            raw = { text: await response.text() }
          }
        }
        catch (err) {
          console.warn('Failed to parse error response:', err)
        }

        const requestError = new RequestError(message, {
          code,
          response,
          raw,
          isBusinessError: false,
          options: mergedConfig,
        })

        // 调用错误处理回调
        this.handleError(requestError, mergedConfig)

        throw requestError
      }

      this.handleError(error, mergedConfig)
      throw error
    }
  }

  /**
   * 处理请求错误
   */
  private handleError(error: unknown, config: RequestOption): void {
    const makeErrorMessage = config.makeErrorMessage

    if (error instanceof RequestError) {
      // 已经是 RequestError，直接调用回调
      makeErrorMessage?.(error.message, error)
    }
    else if (error instanceof HTTPError) {
      // 这是 ky 抛出的 HTTP 错误 (如 404, 500)
      const _error = error as HTTPError & { isBusinessError?: boolean }
      _error.isBusinessError = false
      makeErrorMessage?.(_error.message, _error as any)
    }
    else if (error instanceof Error) {
      // 其他类型的错误 (如超时、网络问题)
      makeErrorMessage?.(error.message, error as RequestError)
    }
  }

  /**
   * 格式化网络错误信息
   */
  private formatNetworkError(response: Response): { message: string, code: number } {
    const status = response.status
    const errorMessages: Record<number, string> = {
      400: '请求参数错误',
      401: '未授权或登录已过期',
      403: '没有权限访问该资源',
      404: '请求的资源不存在',
      500: '服务器内部错误',
      502: '网关错误',
      503: '服务不可用',
      504: '网关超时',
    }

    const message = errorMessages[status] || `网络错误，状态码：${status}`
    return { message, code: status }
  }

  /**
   * 扩展当前实例，创建一个新的 Request 实例
   */
  public extend(options: RequestOption): Request {
    const mergedOptions = merge(merge({}, this.requestOption), options)
    return new Request(mergedOptions)
  }

  /**
   * 创建一个新的 Request 实例（静态方法）
   */
  public static create(options?: RequestOption): Request {
    return new Request(options)
  }
}
export { Request }
export type { RequestOption }
