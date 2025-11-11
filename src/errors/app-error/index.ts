import type { RequestOption } from '../../type'

export class RequestError<T = unknown> extends Error {
  /** 后端返回的错误 code */
  code?: string | number

  /** 原始后端响应体 */
  raw?: T

  /** ky 的原始 Response 对象 */
  response?: Response

  /** 是否是业务错误 */
  isBusinessError: boolean

  /** 请求对象 */
  options?: RequestOption

  constructor(
    message: string,
    options: {
      code?: string | number
      raw?: T
      response?: Response
      isBusinessError: boolean
      options?: RequestOption
    },
  ) {
    super(message)
    this.name = 'RequestError'
    this.code = options.code
    this.raw = options.raw
    this.response = options.response
    this.isBusinessError = options.isBusinessError
    this.options = options.options

    // 确保错误堆栈正确
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RequestError)
    }
  }

  /**
   * 判断是否是网络错误（HTTP 错误）
   */
  isNetworkError(): boolean {
    return !this.isBusinessError
  }

  /**
   * 判断是否是指定的 HTTP 错误
   * @param status 可选的 HTTP 状态码，不传则判断是否为任意 HTTP 错误
   */
  isHttpError(status?: number): boolean {
    if (!this.response)
      return false
    return status ? this.response.status === status : !this.response.ok
  }

  /**
   * 判断是否是 4xx 客户端错误
   */
  is4xxError(): boolean {
    return this.response ? this.response.status >= 400 && this.response.status < 500 : false
  }

  /**
   * 判断是否是 5xx 服务器错误
   */
  is5xxError(): boolean {
    return this.response ? this.response.status >= 500 : false
  }

  /**
   * 判断是否是超时错误
   */
  isTimeout(): boolean {
    return this.message.includes('timeout') || this.message.includes('超时')
  }

  /**
   * 格式化错误信息
   */
  toString(): string {
    const type = this.isBusinessError ? '业务错误' : '网络错误'
    const code = this.code ? ` [${this.code}]` : ''
    return `${type}${code}: ${this.message}`
  }

  /**
   * 转换为 JSON 对象
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      isBusinessError: this.isBusinessError,
      raw: this.raw,
      status: this.response?.status,
      statusText: this.response?.statusText,
    }
  }
}
