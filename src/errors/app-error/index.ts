export class RequestError<T = any> extends Error {
  /** 后端返回的错误 code */
  code?: string | number

  /** 原始后端响应体 */
  raw?: T

  /** ky 的原始 Response 对象 */
  response?: Response

  /** 是否是业务错误 */
  isBusinessError: boolean = true

  constructor(message: string, options?: Partial<Pick<RequestError, 'code' | 'raw' | 'response' | 'isBusinessError'>>) {
    super(message)
    this.name = 'RequestError'
    if (options?.code)
      this.code = options.code
    if (options?.raw)
      this.raw = options.raw
    if (options?.response)
      this.response = options.response
    if (options?.isBusinessError)
      this.isBusinessError = options.isBusinessError
  }
}
