import type { KyInstance } from 'ky'
import type { AuthOptions, LifecycleCallbacks, RequestOption } from './type'
import ky, { HTTPError } from 'ky'
import { RequestError } from './errors/app-error'
import { paramsSerializerHook } from './modules/params-serializer-hook'
import { createResponseParserHook } from './modules/response'
import { merge } from './utils/merge'

class Request {
  private readonly instance: KyInstance
  private readonly requestOption: RequestOption

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

  constructor(requestOption?: RequestOption) {
    // 合并默认配置和传入的配置
    // 注意：不设置默认 Content-Type，让 ky 根据请求体类型自动设置
    const defaultConfig: RequestOption = {
      timeout: 10_000,
    }
    const requestConfig = merge(defaultConfig, requestOption || {})

    // 强制保证 hooks.beforeRequest 存在并顺序正确
    requestConfig.hooks ??= {}
    requestConfig.hooks.beforeRequest = [
      paramsSerializerHook,
      // 添加 auth 和 getHeaders 的 hook
      this.createAuthHook(requestConfig.auth, requestConfig.getHeaders),
      // 添加默认 Content-Type 的 hook（仅当请求体不是 FormData 时）
      this.createContentTypeHook(),
      ...(requestConfig.hooks.beforeRequest ?? []),
    ]

    // 插入 response 解析 hook（如果提供）
    if (requestOption?.responseParser) {
      requestConfig.hooks.afterResponse = [
        // 添加 onUnauthorized 的 hook（必须在 responseParser 之前，否则 401 会被 responseParser 抛出错误）
        this.createUnauthorizedHook(requestConfig.onUnauthorized),
        createResponseParserHook(),
        ...(requestConfig.hooks.afterResponse ?? []),
      ]
    }
    else {
      // 即使没有 responseParser，也需要处理 onUnauthorized
      requestConfig.hooks.afterResponse = [
        this.createUnauthorizedHook(requestConfig.onUnauthorized),
        ...(requestConfig.hooks.afterResponse ?? []),
      ]
    }

    this.instance = ky.create(requestConfig)
    this.requestOption = requestConfig
  }

  /**
   * 创建 auth 和 getHeaders 的 beforeRequest hook
   */
  private createAuthHook(
    auth?: AuthOptions,
    getHeaders?: () => Record<string, string> | Promise<Record<string, string>>,
  ) {
    return async (request: globalThis.Request) => {
      // 处理 auth token 注入
      if (auth?.getToken) {
        const token = await auth.getToken()
        if (token) {
          const headerName = auth.headerName ?? 'Authorization'
          const scheme = auth.scheme === undefined ? 'Bearer' : auth.scheme
          const headerValue = scheme ? `${scheme} ${token}` : token
          request.headers.set(headerName, headerValue)
        }
      }

      // 处理额外 headers 注入
      if (getHeaders) {
        const headers = await getHeaders()
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            if (value) {
              request.headers.set(key, value)
            }
          })
        }
      }
    }
  }

  /**
   * 创建默认 Content-Type 的 beforeRequest hook
   * 仅当请求没有设置 Content-Type 且请求体不是 FormData 时设置默认值
   */
  private createContentTypeHook() {
    return (request: globalThis.Request, options: { body?: unknown }) => {
      // FormData 不需要设置 Content-Type，让浏览器/fetch 自动设置（包含 boundary）
      // 注意：不要删除 Content-Type，因为 fetch 在 beforeRequest 之后不会重新设置
      if (options.body instanceof FormData) {
        return
      }
      // 如果已经设置了 Content-Type，不做任何处理
      if (request.headers.has('Content-Type')) {
        return
      }
      // 对于非 FormData 请求，设置默认的 JSON Content-Type
      request.headers.set('Content-Type', 'application/json;charset=utf-8')
    }
  }

  /**
   * 创建 onUnauthorized 的 afterResponse hook
   */
  private createUnauthorizedHook(onUnauthorized?: () => void) {
    return async (_request: globalThis.Request, _options: unknown, response: Response) => {
      if (response.status === 401 && onUnauthorized) {
        onUnauthorized()
      }
      return response
    }
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
   * 自动检测 FormData 并正确处理 Content-Type
   */
  public patch<T = any>(url: string, data?: unknown, config?: RequestOption): Promise<T> {
    if (data instanceof FormData) {
      return this.request<T>(url, { ...config, body: data, method: 'PATCH' })
    }
    return this.request<T>(url, { ...config, json: data, method: 'PATCH' })
  }

  /**
   * POST请求方法
   * 自动检测 FormData 并正确处理 Content-Type
   */
  public post<T = any>(url: string, data?: unknown, config?: RequestOption): Promise<T> {
    if (data instanceof FormData) {
      return this.request<T>(url, { ...config, body: data, method: 'POST' })
    }
    return this.request<T>(url, { ...config, json: data, method: 'POST' })
  }

  /**
   * PUT请求方法
   * 自动检测 FormData 并正确处理 Content-Type
   */
  public put<T = any>(url: string, data?: unknown, config?: RequestOption): Promise<T> {
    if (data instanceof FormData) {
      return this.request<T>(url, { ...config, body: data, method: 'PUT' })
    }
    return this.request<T>(url, { ...config, json: data, method: 'PUT' })
  }

  /**
   * 通用的请求方法
   */
  public async request<T>(url: string, config: RequestOption): Promise<T> {
    // 获取生命周期回调（请求级优先于实例级）
    const onRequest = config.onRequest ?? this.requestOption.onRequest
    const onResponse = config.onResponse ?? this.requestOption.onResponse
    const onError = config.onError ?? this.requestOption.onError

    // 处理 unwrap 快捷配置
    let finalConfig = config
    if (config.unwrap !== undefined && this.requestOption.responseParser) {
      const baseParser = this.requestOption.responseParser
      if (config.unwrap) {
        // unwrap: true - 使用实例级 responseParser 配置
        finalConfig = {
          ...config,
          responseParser: baseParser,
        }
      }
      else {
        // unwrap: false - 返回完整响应体
        finalConfig = {
          ...config,
          responseParser: { responseReturn: 'body' as const },
        }
      }
    }

    const responseReturn = this.requestOption?.responseParser?.responseReturn === 'raw' || finalConfig.responseParser?.responseReturn === 'raw'
    const prefixUrl = finalConfig.prefixUrl || this.requestOption.prefixUrl
    if (prefixUrl) {
      // 去除url开头的斜杠
      url = url.startsWith('/') ? url.slice(1) : url
    }

    // 调用 onRequest 回调
    const method = finalConfig.method || 'GET'
    const fullUrl = prefixUrl ? `${prefixUrl}${url}` : url
    onRequest?.(method, fullUrl)

    try {
      const response = await this.instance(url, finalConfig)

      // 调用 onResponse 回调
      onResponse?.(method, fullUrl, response.status)

      if (responseReturn) {
        return response as T
      }
      return await response.json() as T
    }
    catch (error: unknown) {
      const makeErrorMessage = finalConfig.makeErrorMessage || this.requestOption.makeErrorMessage

      if (error instanceof HTTPError) {
        // 这是 ky 抛出的 HTTP 错误 (如 404, 500)
        const _error = error as HTTPError
        Object.defineProperty(_error, 'isBusinessError', { value: false, writable: false, configurable: false })

        // 调用 onResponse 回调（错误响应）
        onResponse?.(method, fullUrl, _error.response.status)

        // 调用 onError 回调
        onError?.(_error as unknown as RequestError, _error.response)

        makeErrorMessage?.(_error.message, _error as any)
      }
      else if (error instanceof RequestError) {
        // 这是 responseParser hook 抛出的业务错误或 HTTP 错误
        const _error = error as RequestError

        // 调用 onResponse 回调（如果有 response）
        if (_error.response) {
          onResponse?.(method, fullUrl, _error.response.status)
        }

        // 调用 onError 回调
        onError?.(_error, _error.response)

        makeErrorMessage?.(_error.message, _error)
      }
      else if (error instanceof Error) {
        // 其他类型的错误 (如超时、网络问题)
        // 调用 onError 回调
        onError?.(error as RequestError, undefined)

        makeErrorMessage?.(error.message, error as RequestError)
      }
      throw error
    }
  }
}
/**
 * 创建请求客户端实例
 * @param requestOption 初始化配置
 * @returns Request 实例
 * @example
 * ```typescript
 * const client = createClient({
 *   prefixUrl: 'https://api.example.com',
 *   auth: { getToken: () => localStorage.getItem('token') },
 *   onUnauthorized: () => redirectToLogin(),
 * })
 *
 * const data = await client.get('/users')
 * ```
 */
function createClient(requestOption?: RequestOption): Request {
  return new Request(requestOption)
}

export { createClient, Request }
export type { AuthOptions, LifecycleCallbacks, RequestOption }
