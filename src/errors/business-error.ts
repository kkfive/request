import type { RequestConfig } from '../types'

/**
 * 业务逻辑错误。
 *
 * 仅表示「HTTP 状态为 2xx，但响应体的业务状态字段（如 `code`）不等于 `successCode`」这一情形——
 * 这是 kk-request 独有的领域错误。`instanceof BusinessError` 即业务错误判定。
 *
 * 传输层错误（非 2xx / 网络 / 超时等）请使用 ky 的原生类型：
 * `HTTPError` / `NetworkError` / `TimeoutError` / `ForceRetryError`（均从本包重新导出），
 * 配合 `isHTTPError` 等类型守卫区分处理。
 */
export class BusinessError<T = unknown> extends Error {
  /** 后端返回的业务错误 code */
  code?: string | number

  /** 原始后端响应体 */
  raw?: T

  /** ky 的原始 Response 对象 */
  response?: Response

  /** 触发该错误的请求配置 */
  options?: RequestConfig

  constructor(message: string, options: Pick<BusinessError<T>, 'code' | 'raw' | 'response' | 'options'>) {
    super(message)
    this.name = 'BusinessError'
    this.options = options.options
    this.code = options.code
    this.raw = options.raw as T
    this.response = options.response
  }
}
