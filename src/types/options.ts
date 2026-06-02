import type { Options, StandardSchemaV1, StandardSchemaV1Issue } from 'ky'
import type { BuiltInHooksConfig, ExtendedHooks } from './hooks'
import type { ResponseParserConfig } from './response'

/**
 * 认证配置选项
 */
interface AuthConfig {
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
  /**
   * refresh token 配置
   */
  refreshToken?: {
    /**
     * 获取 refresh token 的函数
     */
    getRefreshToken: () => string | Promise<string>
    /**
     * 刷新 token 的函数，返回新的 access token
     */
    refresh: (refreshToken: string) => Promise<string>
    /**
     * token 刷新成功时的回调
     */
    onRefreshSuccess?: (newToken: string) => void | Promise<void>
    /**
     * token 刷新失败时的回调
     */
    onRefreshFail?: (error: Error) => void
  }
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
  onError?: (error: Error, response?: Response) => void
  /**
   * 401 未授权时回调
   */
  onUnauthorized?: () => void
  /**
   * schema 校验失败时回调（仅 `warn` 模式触发）。提供后取代默认的 `console.warn`。
   */
  onValidationError?: (issues: readonly StandardSchemaV1Issue[]) => void
}

/**
 * 扩展配置选项
 */
interface ExtendedOptions {
  /**
   * URL 查询参数
   */
  params?: Record<string, unknown>
  /**
   * 参数序列化方式
   * - brackets: ids[]=1&ids[]=2&ids[]=3
   * - comma: ids=1,2,3
   * - indices: ids[0]=1&ids[1]=2&ids[2]=3
   * - repeat: ids=1&ids=2&ids=3
   */
  paramsSerializer?: 'brackets' | 'comma' | 'indices' | 'repeat'
  /**
   * 响应数据的返回方式
   */
  responseParser?: ResponseParserConfig
  /**
   * 对返回错误做一些副作用行为（例如客户端遇到错误自动弹出提示）
   * @deprecated 请使用 onError 回调代替
   */
  makeErrorMessage?: (message: string, error: Error) => void | null
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
  auth?: AuthConfig
  /**
   * 获取额外 headers 的函数，支持异步
   */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
  /**
   * 内置 hooks 功能开关（简化版控制）
   */
  features?: BuiltInHooksConfig
  /**
   * 扩展的 hooks 配置（高级控制）
   */
  extendedHooks?: ExtendedHooks
  /**
   * 响应数据校验 schema（Standard Schema，如 zod 3.24+ / valibot / arktype）。
   * 传入后返回类型自动推导为 schema 的输出类型，优先于手动泛型 `<T>`。
   *
   * 校验对象随 `responseParser` 模式而定：`data` 模式校验提取后的 data、
   * `body` 模式校验完整响应体；`raw` 模式不校验（会 `console.warn` 一次提示）。
   */
  schema?: StandardSchemaV1
  /**
   * schema 校验模式（仅在传入 `schema` 时有意义）。
   * - `strict`（默认）：校验失败抛 `SchemaValidationError`
   * - `warn`：校验失败不抛，调用 `onValidationError` 或 `console.warn`，降级返回未经 transform 的原始数据
   * - `off`：不执行校验，直接返回数据
   *
   * 库不读取环境变量；如需按环境切换，请在调用处用打包器变量映射后传入，例如
   * `schemaValidation: import.meta.env.PROD ? 'off' : 'strict'`。
   * @default 'strict'
   */
  schemaValidation?: 'strict' | 'warn' | 'off'
}

/**
 * 自定义选项（用户扩展）
 */
interface CustomOptions {}

/**
 * 请求配置选项
 */
type RequestConfig = Options & ExtendedOptions & LifecycleCallbacks & CustomOptions

export type {
  AuthConfig,
  CustomOptions,
  ExtendedOptions,
  LifecycleCallbacks,
  RequestConfig,
}
