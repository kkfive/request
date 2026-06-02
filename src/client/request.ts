import type { KyInstance, StandardSchemaV1, StandardSchemaV1InferOutput } from 'ky'
import type { RequestConfig } from '../types'
import ky, { isHTTPError, SchemaValidationError } from 'ky'
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
  public delete<S extends StandardSchemaV1>(url: string, config: RequestConfig & { schema: S }): Promise<StandardSchemaV1InferOutput<S>>
  public delete<T = unknown>(url: string, config?: RequestConfig): Promise<T>
  public delete(url: string, config?: RequestConfig): Promise<unknown> {
    return this.request(url, { ...config, method: 'DELETE' })
  }

  /**
   * GET 请求方法
   */
  public get<S extends StandardSchemaV1>(url: string, config: RequestConfig & { schema: S }): Promise<StandardSchemaV1InferOutput<S>>
  public get<T = unknown>(url: string, config?: RequestConfig): Promise<T>
  public get(url: string, config?: RequestConfig): Promise<unknown> {
    return this.request(url, { ...config, method: 'GET' })
  }

  /**
   * PATCH 请求方法
   */
  public patch<S extends StandardSchemaV1>(url: string, data: unknown, config: RequestConfig & { schema: S }): Promise<StandardSchemaV1InferOutput<S>>
  public patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T>
  public patch(url: string, data?: unknown, config?: RequestConfig): Promise<unknown> {
    if (data instanceof FormData) {
      return this.request(url, { ...config, body: data, method: 'PATCH' })
    }
    return this.request(url, { ...config, json: data, method: 'PATCH' })
  }

  /**
   * POST 请求方法。`data` 为 `FormData` 时自动作为 body 发送（让浏览器设置 multipart 边界），否则按 JSON 发送。
   */
  public post<S extends StandardSchemaV1>(url: string, data: unknown, config: RequestConfig & { schema: S }): Promise<StandardSchemaV1InferOutput<S>>
  public post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T>
  public post(url: string, data?: unknown, config?: RequestConfig): Promise<unknown> {
    if (data instanceof FormData) {
      return this.request(url, { ...config, body: data, method: 'POST' })
    }
    return this.request(url, { ...config, json: data, method: 'POST' })
  }

  /**
   * PUT 请求方法
   */
  public put<S extends StandardSchemaV1>(url: string, data: unknown, config: RequestConfig & { schema: S }): Promise<StandardSchemaV1InferOutput<S>>
  public put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T>
  public put(url: string, data?: unknown, config?: RequestConfig): Promise<unknown> {
    if (data instanceof FormData) {
      return this.request(url, { ...config, body: data, method: 'PUT' })
    }
    return this.request(url, { ...config, json: data, method: 'PUT' })
  }

  /**
   * 通用底层请求方法，`get` / `post` / `put` / `patch` / `delete` 均基于它实现。
   * 抛错时原样抛出：业务错误为 `BusinessError`，传输层错误为 ky 原生类型（用 `isHTTPError` 等守卫区分）。
   *
   * 传入 `config.schema`（Standard Schema）时返回类型自动推导为 schema 输出类型，并按
   * `schemaValidation`（strict/warn/off）执行校验。
   */
  public request<S extends StandardSchemaV1>(url: string, config: RequestConfig & { schema: S }): Promise<StandardSchemaV1InferOutput<S>>
  public request<T = unknown>(url: string, config: RequestConfig): Promise<T>
  public async request(url: string, config: RequestConfig): Promise<unknown> {
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

      const schema = finalConfig.schema
      if (responseReturn) {
        // raw 模式不解析、不校验；传了 schema 属配置矛盾，warn 一次提示
        // （schema 在全局 config，无法用方法重载在编译期排除该组合，故运行时兜底）
        if (schema) {
          console.warn('[kk-request] raw 模式不执行 schema 校验，已忽略传入的 schema', { url: fullUrl })
        }
        return response
      }

      const jsonValue = await response.json()
      const schemaValidation = finalConfig.schemaValidation ?? this.requestConfig.schemaValidation ?? 'strict'
      if (!schema || schemaValidation === 'off') {
        return jsonValue
      }

      // 三态校验：自跑 Standard Schema 的 ~standard.validate
      // （ky 的 .json(schema) 仅 strict 语义，不复用；复用其 SchemaValidationError 错误类）
      const result = await schema['~standard'].validate(jsonValue)
      if (result.issues) {
        if (schemaValidation === 'strict') {
          throw new SchemaValidationError(result.issues)
        }
        // warn：不抛，上报后降级返回未经 transform 的原始数据
        const onValidationError = finalConfig.onValidationError ?? this.requestConfig.onValidationError
        if (onValidationError) {
          onValidationError(result.issues)
        }
        else {
          console.warn('[kk-request] schema 校验失败', { url: fullUrl, issues: result.issues })
        }
        return jsonValue
      }
      return result.value
    }
    catch (error: unknown) {
      // schema 校验错误属结构层（请求本身已成功），不经传输/业务错误的副作用回调，直接原样抛出
      if (error instanceof SchemaValidationError) {
        throw error
      }

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
