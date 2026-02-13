import type { KyInstance } from 'ky'
import type { RequestConfig } from '../types'
import ky, { HTTPError } from 'ky'
import { RequestError } from '../errors/request-error'
import { resolveHooks } from '../hooks'
import { merge } from '../utils'

class Request {
  private readonly instance: KyInstance
  private readonly requestConfig: RequestConfig

  /**
   * 创建 AbortController 用于取消请求
   */
  public static createAbortController(): AbortController {
    return new AbortController()
  }

  /**
   * 暴露底层 ky 实例，用于特殊场景（如下载文件、获取纯文本）
   */
  public get raw(): KyInstance {
    return this.instance
  }

  constructor(requestConfig?: RequestConfig) {
    const defaultConfig: RequestConfig = {
      timeout: 10_000,
    }
    const mergedConfig = merge(defaultConfig, requestConfig || {})

    // 声明最终实例变量
    let finalInstance: KyInstance

    // 创建 getter 函数，用于延迟绑定，确保 hooks 中使用的是包含完整 hooks 链的实例
    const getKyInstance = (): KyInstance => finalInstance

    // 使用 resolveHooks 构建 hooks，传递 getter 函数
    const hooks = resolveHooks(mergedConfig, getKyInstance)

    // 创建最终实例，包含完整的 hooks 配置
    finalInstance = ky.create({ ...mergedConfig, hooks })
    this.instance = finalInstance
    this.requestConfig = mergedConfig
  }

  /**
   * DELETE 请求方法
   */
  public delete<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' })
  }

  /**
   * GET 请求方法
   */
  public get<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' })
  }

  /**
   * PATCH 请求方法
   */
  public patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    if (data instanceof FormData) {
      return this.request<T>(url, { ...config, body: data, method: 'PATCH' })
    }
    return this.request<T>(url, { ...config, json: data, method: 'PATCH' })
  }

  /**
   * POST 请求方法
   */
  public post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    if (data instanceof FormData) {
      return this.request<T>(url, { ...config, body: data, method: 'POST' })
    }
    return this.request<T>(url, { ...config, json: data, method: 'POST' })
  }

  /**
   * PUT 请求方法
   */
  public put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    if (data instanceof FormData) {
      return this.request<T>(url, { ...config, body: data, method: 'PUT' })
    }
    return this.request<T>(url, { ...config, json: data, method: 'PUT' })
  }

  /**
   * 通用的请求方法
   */
  public async request<T = unknown>(url: string, config: RequestConfig): Promise<T> {
    const onRequest = config.onRequest ?? this.requestConfig.onRequest
    const onResponse = config.onResponse ?? this.requestConfig.onResponse
    const onError = config.onError ?? this.requestConfig.onError

    // 处理 unwrap 快捷配置
    let finalConfig = config
    if (config.unwrap !== undefined && this.requestConfig.responseParser) {
      const baseParser = this.requestConfig.responseParser
      if (config.unwrap) {
        finalConfig = {
          ...config,
          responseParser: baseParser,
        }
      }
      else {
        finalConfig = {
          ...config,
          responseParser: { responseReturn: 'body' as const },
        }
      }
    }

    const responseReturn = this.requestConfig?.responseParser?.responseReturn === 'raw'
      || finalConfig.responseParser?.responseReturn === 'raw'
    const prefixUrl = finalConfig.prefixUrl || this.requestConfig.prefixUrl

    if (prefixUrl) {
      url = url.startsWith('/') ? url.slice(1) : url
    }

    const method = finalConfig.method || 'GET'
    const fullUrl = prefixUrl ? `${prefixUrl}${url}` : url
    onRequest?.(method, fullUrl)

    try {
      const response = await this.instance(url, finalConfig)
      onResponse?.(method, fullUrl, response.status)

      if (responseReturn) {
        return response as T
      }
      return await response.json() as T
    }
    catch (error: unknown) {
      const makeErrorMessage = finalConfig.makeErrorMessage || this.requestConfig.makeErrorMessage

      if (error instanceof HTTPError) {
        const _error = error as HTTPError
        Object.defineProperty(_error, 'isBusinessError', { value: false, writable: false, configurable: false })
        onResponse?.(method, fullUrl, _error.response.status)
        onError?.(_error as unknown as RequestError, _error.response)
        makeErrorMessage?.(_error.message, _error as unknown as RequestError)
      }
      else if (error instanceof RequestError) {
        const _error = error as RequestError
        if (_error.response) {
          onResponse?.(method, fullUrl, _error.response.status)
        }
        onError?.(_error, _error.response)
        makeErrorMessage?.(_error.message, _error)
      }
      else if (error instanceof Error) {
        onError?.(error as RequestError, undefined)
        makeErrorMessage?.(error.message, error as RequestError)
      }
      throw error
    }
  }
}

/**
 * 创建请求客户端实例
 * @example
 * ```typescript
 * const client = createClient({
 *   prefixUrl: 'https://api.example.com',
 *   auth: { getToken: () => localStorage.getItem('token') },
 *   onUnauthorized: () => redirectToLogin(),
 * })
 *
 * // 禁用某个内置 hook
 * const client = createClient({
 *   features: { enableContentType: false },
 * })
 *
 * // 高级控制
 * const client = createClient({
 *   extendedHooks: {
 *     control: { disable: ['paramsSerializer'] },
 *     beforeRequest: { prepend: [myCustomHook] },
 *   },
 * })
 * ```
 */
function createClient(requestConfig?: RequestConfig): Request {
  return new Request(requestConfig)
}

export { createClient, Request }
