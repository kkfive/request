import type { RequestConfig } from '../types'

export class RequestError<T = unknown> extends Error {
  /** 后端返回的错误 code */
  code?: string | number

  /** 原始后端响应体 */
  raw?: T

  /** ky 的原始 Response 对象 */
  response?: Response

  /** 是否是业务错误 */
  isBusinessError: boolean = true

  /** 请求对象 */
  options?: RequestConfig

  constructor(message: string, options: Pick<RequestError<T>, 'code' | 'raw' | 'response' | 'isBusinessError' | 'options'>) {
    super(message)
    this.name = 'RequestError'
    this.options = options?.options
    this.code = options.code
    this.raw = options.raw as T
    this.response = options.response
    this.isBusinessError = options.isBusinessError
  }
}
