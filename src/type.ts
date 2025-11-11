import type { Options } from 'ky'
import type { RequestError } from './errors/app-error'
import type { ResponseParserOptions } from './modules/response'

interface CustomOptions {}

interface ExtendOptions {
  params?: Record<string, any>
  /**
   * 参数序列化方式。预置的有
   * - brackets: ids[]=1&ids[]=2&ids[]=3
   * - comma: ids=1,2,3
   * - indices: ids[0]=1&ids[1]=2&ids[2]=3
   * - repeat: ids=1&ids=2&ids=3
   */
  paramsSerializer?: 'brackets' | 'comma' | 'indices' | 'repeat'

  /**
   * 响应数据的返回方式
   */
  responseParser?: ResponseParserOptions

  /**
   * 对返回错误做一些副作用行为（例如客户端遇到错误自动弹出提示）
   */
  makeErrorMessage?: (message: string, error: RequestError) => void
}

type RequestOption = Options & ExtendOptions & CustomOptions

export type { RequestOption, ResponseParserOptions }
