/**
 * 响应返回模式
 * - raw: 返回原始 Response 实例
 * - body: 解析 JSON 返回完整响应体
 * - data: 解析 JSON 并提取指定字段
 */
type ResponseReturnMode = 'raw' | 'body' | 'data'

/**
 * 响应返回模式说明
 *
 * @description
 * - **raw**: 返回原始的 `Response` 实例；不解析 JSON；不进行 HTTP 状态码或业务 code 检查；
 *   适合调用方手动处理响应，例如用于下载文件、获取 headers 等。
 *
 * - **body**: 自动将响应解析为 JSON 并返回完整结构（如 `{ code, msg, data }`）；
 *   只校验 HTTP 状态码为 2xx；不检查业务 code 成功状态；
 *   适合调用方自行判断业务逻辑是否成功。
 *
 * - **data**: 解析响应 JSON，并提取指定字段（默认提取 `data` 字段）；
 *   同时校验 HTTP 状态码为 2xx 且业务 code 符合 `successCode` 要求；
 *   不符合时抛出错误；适合统一业务成功判定和数据提取的情况。
 */
interface BaseParserOptions {
  /**
   * 指定响应返回的处理方式
   * @default 'body'
   */
  responseReturn: ResponseReturnMode
}

/**
 * 'data' 模式的响应解析配置
 */
interface ResponseParserDataConfig extends BaseParserOptions {
  responseReturn: 'data'
  /**
   * 响应体中标识业务状态码的字段名
   * @default 'code'
   */
  codeField?: string
  /**
   * 响应体中实际数据的字段名，或用于自定义提取逻辑的函数
   * @default 'data'
   */
  dataField?: string | ((res: unknown) => unknown)
  /**
   * 代表接口成功状态的 code 值，或用于判断成功的函数
   * @default 0
   */
  successCode?: number | string | boolean | ((code: unknown) => boolean)
  /**
   * 失败响应中，业务错误码所在字段名
   * @default same as codeField
   */
  errorCodeField?: string
  /**
   * 失败响应中，业务错误信息所在字段名或提取函数
   * @default 'message'
   */
  errorMessageField?: string | ((res: unknown) => string)
}

/**
 * 'body' 模式的响应解析配置
 */
interface ResponseParserBodyConfig extends BaseParserOptions {
  responseReturn: 'body'
}

/**
 * 'raw' 模式的响应解析配置
 */
interface ResponseParserRawConfig extends BaseParserOptions {
  responseReturn: 'raw'
}

/**
 * 响应解析配置联合类型
 */
type ResponseParserConfig =
  | ResponseParserDataConfig
  | ResponseParserBodyConfig
  | ResponseParserRawConfig

export type {
  BaseParserOptions,
  ResponseParserBodyConfig,
  ResponseParserConfig,
  ResponseParserDataConfig,
  ResponseParserRawConfig,
  ResponseReturnMode,
}
