import type { RequestOption } from '../../type'

export class RequestError<T = any> extends Error {
  /** 后端返回的错误 code */
  code?: string | number

  /** 原始后端响应体 */
  raw?: T

  /** ky 的原始 Response 对象 */
  response?: Response

  /** 是否是业务错误 */
  isBusinessError: boolean = true

  /** 请求对象 */
  options?: RequestOption

  constructor(message: string, options: Pick<RequestError, 'code' | 'raw' | 'response' | 'isBusinessError' | 'options'>) {
    super(message)
    this.name = 'RequestError'
    this.options = options?.options
    this.code = options.code
    this.raw = options.raw
    this.response = options.response
    this.isBusinessError = options.isBusinessError
  }
}
