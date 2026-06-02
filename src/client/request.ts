import type { KyInstance } from 'ky'
import type { RequestConfig } from '../types'
import ky, { isHTTPError } from 'ky'
import { BusinessError } from '../errors'
import { resolveHooks } from '../hooks'
import { merge } from '../utils'

/**
 * HTTP 请求客户端。通常通过 {@link createClient} 创建，而非直接 `new`。
 *
 * 提供 `get` / `post` / `put` / `patch` / `delete` 方法；返回值类型由实例级
 * `responseParser.responseReturn` 与请求级 `unwrap` 共同决定。
 *
 * @example
 * ```typescript
 * const http = createClient({
 *   prefix: 'https://api.example.com',
 *   responseParser: { responseReturn: 'data' },
 * })
 *
 * const users = await http.get<User[]>('/users')
 * const created = await http.post<User>('/users', { name: 'kk' })
 *
 * // 请求级覆盖响应模式（返回完整响应体而非 data 字段）
 * const full = await http.get('/users', { unwrap: false })
 *
 * // 取消请求
 * const ac = Request.createAbortController()
 * http.get('/slow', { signal: ac.signal })
 * ac.abort()
 * ```
 */
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

    // 401 重试改用 ky 原生 ky.retry()，hooks 无需回引实例，直接创建即可
    const hooks = resolveHooks(mergedConfig)
    this.instance = ky.create({ ...mergedConfig, hooks })
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
   * POST 请求方法。`data` 为 `FormData` 时自动作为 body 发送（让浏览器设置 multipart 边界），否则按 JSON 发送。
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
   * 通用底层请求方法，`get` / `post` / `put` / `patch` / `delete` 均基于它实现。
   * 抛错时原样抛出：业务错误为 `BusinessError`，传输层错误为 ky 原生类型（用 `isHTTPError` 等守卫区分）。
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
          responseParser: {
            ...baseParser,
            responseReturn: 'data' as const,
          },
        }
      }
      else {
        finalConfig = {
          ...config,
          responseParser: {
            ...baseParser,
            responseReturn: 'body' as const,
          },
        }
      }
    }

    const responseReturn = this.requestConfig?.responseParser?.responseReturn === 'raw'
      || finalConfig.responseParser?.responseReturn === 'raw'
    // ky 2.0：prefixUrl 已更名为 prefix，且原生支持 input 带前导斜杠，无需再手动去斜杠
    const prefix = finalConfig.prefix || this.requestConfig.prefix

    const method = finalConfig.method || 'GET'
    const fullUrl = prefix
      ? `${String(prefix).replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
      : url
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

      // 原样抛出：业务错误为 BusinessError，传输层错误为 ky 的 HTTPError/NetworkError/TimeoutError 等。
      // 保留完整错误信息，交给上层用 instanceof BusinessError / ky 类型守卫(isHTTPError 等)区分处理。
      const errResponse = isHTTPError(error)
        ? error.response
        : error instanceof BusinessError
          ? error.response
          : undefined

      if (errResponse) {
        onResponse?.(method, fullUrl, errResponse.status)
      }
      if (error instanceof Error) {
        onError?.(error, errResponse)
        makeErrorMessage?.(error.message, error)
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
 *   prefix: 'https://api.example.com',
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
