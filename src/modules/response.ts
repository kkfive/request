import type { AfterResponseHook } from 'ky'
import type { RequestOption } from '../type'
import { RequestError } from '../errors/app-error'
import { isFunction } from '../utils/isFunction'

interface ResponseParserData {
  /**
   * 指定响应返回的处理方式。
   * @default 'body'
   * @example raw
   * 返回原始的 `Response` 实例；
   * 不解析 JSON；
   * 不进行 HTTP 状态码或业务 code 检查；
   * 适合调用方手动处理响应，例如用于下载文件、获取 headers 等。
   * @example body
   * 自动将响应解析为 JSON 并返回完整结构（如 `{ code, msg, data }`）；
   * 只校验 HTTP 状态码为 2xx；
   * 不检查业务 code 成功状态；
   * 适合调用方自行判断业务逻辑是否成功。
   * @example data
   * 解析响应 JSON，并提取指定字段（默认提取 `data` 字段）；
   * 同时校验 HTTP 状态码为 2xx 且业务 code 符合 `successCode` 要求；
   * 不符合时抛出错误；
   * 适合统一业务成功判定和数据提取的情况。
   */
  responseReturn: 'data'
  /**
   * 响应体中标识业务状态码的字段名。
   *
   * 常见为 `'code'`、`'statusCode'`、`'success'` 等。
   * 仅当 `responseReturn` 为 `'data'` 时生效。
   *
   * @default 'code'
   */
  codeField: string

  /**
   * 响应体中实际数据的字段名，或用于自定义提取逻辑的函数。
   *
   * - 如果为字符串，例如 `'data'`、`'result'`，将提取该字段作为最终返回；
   * - 如果为函数，将传入完整响应体并返回需要的数据片段；
   *
   * 仅当 `responseReturn` 为 `'data'` 时生效。
   *
   * @default 'data'
   */
  dataField: string | ((res: any) => any)

  /**
   * 代表接口成功状态的 code 值，或用于判断成功的函数。
   *
   * - 数值或字符串：代表固定的成功状态码；
   * - 函数：接收实际 code 值并返回是否为成功；
   *
   * 仅当 `responseReturn` 为 `'data'` 时生效。
   *
   * @default 0
   */
  successCode: number | string | ((code: any) => boolean)

  /**
   * 失败响应中，业务错误码所在字段名。
   * 用于赋值 `AppError.code` 字段。
   *
   * @default same as codeField
   */
  errorCodeField: string

  /**
   * 失败响应中，业务错误信息所在字段名或提取函数。
   * 用于赋值 `AppError.message`。
   *
   * @default 'message'
   */
  errorMessageField: string | ((res: any) => string)
}
/**
 * 配置响应解析行为的选项，用于控制请求返回值的格式与成功判断逻辑。
 */
interface ResponseParserRaw {
  /**
   * 指定响应返回的处理方式。
   *
   * @default 'body'
   * @example raw
   * 返回原始的 `Response` 实例；
   * 不解析 JSON；
   * 不进行 HTTP 状态码或业务 code 检查；
   * 适合调用方手动处理响应，例如用于下载文件、获取 headers 等。
   * @example body
   * 自动将响应解析为 JSON 并返回完整结构（如 `{ code, msg, data }`）；
   * 只校验 HTTP 状态码为 2xx；
   * 不检查业务 code 成功状态；
   * 适合调用方自行判断业务逻辑是否成功。
   * @example data
   * 解析响应 JSON，并提取指定字段（默认提取 `data` 字段）；
   * 同时校验 HTTP 状态码为 2xx 且业务 code 符合 `successCode` 要求；
   * 不符合时抛出错误；
   * 适合统一业务成功判定和数据提取的情况。
   */
  responseReturn: 'raw'

}

interface ResponseParserBody {
  /**
   * 指定响应返回的处理方式。
   *
   * @default 'body'
   * @example raw
   * 返回原始的 `Response` 实例；
   * 不解析 JSON；
   * 不进行 HTTP 状态码或业务 code 检查；
   * 适合调用方手动处理响应，例如用于下载文件、获取 headers 等。
   * @example body
   * 自动将响应解析为 JSON 并返回完整结构（如 `{ code, msg, data }`）；
   * 只校验 HTTP 状态码为 2xx；
   * 不检查业务 code 成功状态；
   * 适合调用方自行判断业务逻辑是否成功。
   * @example data
   * 解析响应 JSON，并提取指定字段（默认提取 `data` 字段）；
   * 同时校验 HTTP 状态码为 2xx 且业务 code 符合 `successCode` 要求；
   * 不符合时抛出错误；
   * 适合统一业务成功判定和数据提取的情况。
   */
  responseReturn: 'body'
}

type ResponseParserOptions = ResponseParserData | ResponseParserBody | ResponseParserRaw
/**
 * 创建一个用于解析 ky 响应的 hook。
 */
function createResponseParserHook(): AfterResponseHook {
  return async (_request, options, response) => {
    const _options = options as RequestOption
    const responseReturnConfig = _options?.responseParser
    const { responseReturn = 'raw' } = responseReturnConfig ?? {}
    // 不处理任何内容，直接返回原始 Response
    if (!responseReturn || responseReturn === 'raw') {
      return response
    }

    const _response = response.clone()

    if (!response.ok) {
      const { message, code } = formatNetworkError(_response)
      throw new RequestError(message, {
        code,
        response,
        raw: await _response.json().catch(() => ({})),
        isBusinessError: false,
        options: _options,
      })
    }

    // 解析 JSON，只在需要时执行
    const json: any = await _response.json()

    // 如果仅要求返回整个响应 JSON
    if (responseReturn === 'body') {
      return new Response(JSON.stringify(json), response)
    }

    const { codeField = 'code', dataField = 'data', successCode = 0, errorCodeField = 'code', errorMessageField = 'message' } = responseReturnConfig as ResponseParserData

    const code = json?.[codeField]
    const isSuccess = isFunction(successCode)
      ? successCode(code)
      : code === successCode

    if (!isSuccess) {
      const errorMsg = isFunction(errorMessageField)
        ? errorMessageField(json)
        : json?.[errorMessageField] || json?.msg || '接口响应失败'

      const errorCode = json?.[errorCodeField ?? codeField]

      throw new RequestError(errorMsg, {
        isBusinessError: false,
        options: _options,
        code: errorCode,
        raw: json,
        response,
      })
    }

    const data = isFunction(dataField)
      ? dataField(json)
      : json?.[dataField]

    return new Response(JSON.stringify(data), response)
  }
}

function formatNetworkError(response: Response): { message: string, code: number } {
  let message
  const status = response.status
  switch (status) {
    case 400:
      message = '请求参数错误'
      break
    case 401:
      message = '未授权或登录已过期'
      break
    case 403:
      message = '没有权限访问该资源'
      break
    case 404:
      message = '请求的资源不存在'
      break
    case 500:
      message = '服务器内部错误'
      break
    default:
      message = `网络错误，状态码：${status}`
  }
  return { message, code: status }
}

export { createResponseParserHook }
export type { ResponseParserOptions }
