import type { Options } from 'ky'
import type { RequestError } from './errors/app-error'
import type { ResponseParserOptions } from './modules/response'

interface CustomOptions {}

/**
 * 认证配置选项
 */
interface AuthOptions {
  /**
   * 获取 token 的函数，支持异步
   */
  getToken: () => string | null | Promise<string | null>
  /**
   * token 放置的 header 名称
   * @default 'Authorization'
   */
  headerName?: string
  /**
   * token 前缀方案，如 'Bearer'
   * 设置为 null 表示不添加前缀
   * @default 'Bearer'
   */
  scheme?: string | null
}

/**
 * 生命周期回调配置
 */
interface LifecycleCallbacks {
  /**
   * 请求发送前回调
   */
  onRequest?: (method: string, url: string) => void
  /**
   * 响应返回后回调
   */
  onResponse?: (method: string, url: string, status: number) => void
  /**
   * 错误发生时回调
   */
  onError?: (error: RequestError, response?: unknown) => void
  /**
   * 401 未授权时回调
   */
  onUnauthorized?: () => void
}

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
   * @deprecated 请使用 onError 回调代替
   */
  makeErrorMessage?: (message: string, error: RequestError) => void | null

  /**
   * 是否解包响应数据，只返回 data 字段
   * - true: 返回 data 字段（需要配合实例级 responseParser 使用）
   * - false: 返回完整响应体
   * @default undefined (使用 responseParser 配置)
   */
  unwrap?: boolean

  /**
   * 认证配置，用于自动注入 token
   */
  auth?: AuthOptions

  /**
   * 获取额外 headers 的函数，支持异步
   */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
}

type RequestOption = Options & ExtendOptions & LifecycleCallbacks & CustomOptions

export type { AuthOptions, LifecycleCallbacks, RequestOption }
