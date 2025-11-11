import type { AfterResponseHook } from 'ky'
import type { RequestOption } from '../type'
import { RequestError } from '../errors/app-error'
import { isFunction } from '../utils/isFunction'

/**
 * 配置响应解析行为的选项
 *
 * 支持三种响应返回模式：
 * - `raw`: 返回原始 Response 实例，不解析 JSON，不进行任何检查。适合文件下载、获取 headers 等场景
 * - `body`: 解析为 JSON 并返回完整结构（如 `{ code, msg, data }`），只校验 HTTP 状态码。适合自行判断业务逻辑
 * - `data`: 解析 JSON 并提取指定字段（默认 `data`），校验 HTTP 状态码和业务 code。适合统一业务成功判定
 */
type ResponseParserOptions
  = | { responseReturn: 'raw' }
    | { responseReturn: 'body' }
    | {
      responseReturn: 'data'
      /**
       * 响应体中标识业务状态码的字段名
       * @default 'code'
       */
      codeField?: string
      /**
       * 响应体中实际数据的字段名或提取函数
       * @default 'data'
       */
      dataField?: string | ((res: any) => any)
      /**
       * 代表接口成功状态的 code 值或判断函数
       * @default 0
       */
      successCode?: number | string | ((code: any) => boolean)
      /**
       * 失败响应中，业务错误码所在字段名
       * @default same as codeField
       */
      errorCodeField?: string
      /**
       * 失败响应中，业务错误信息所在字段名或提取函数
       * @default 'message'
       */
      errorMessageField?: string | ((res: any) => string)
    }
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

    // 克隆响应以便多次读取
    let _response: Response
    try {
      _response = response.clone()
    }
    catch (error) {
      console.warn('Failed to clone response:', error)
      _response = response
    }

    if (!response.ok) {
      const { message, code } = formatNetworkError(_response)

      // 尝试解析错误响应体
      let raw: any = {}
      try {
        const contentType = _response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          raw = await _response.json()
        }
        else {
          raw = { text: await _response.text() }
        }
      }
      catch (error) {
        console.warn('Failed to parse error response:', error)
      }

      throw new RequestError(message, {
        code,
        response,
        raw,
        isBusinessError: false,
        options: _options,
      })
    }

    // 解析 JSON，只在需要时执行
    let json: any
    try {
      const contentType = _response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        throw new Error(`响应不是 JSON 格式，Content-Type: ${contentType || 'unknown'}`)
      }
      json = await _response.json()
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : '响应解析失败'
      throw new RequestError(errorMessage, {
        code: response.status,
        response,
        raw: { error: errorMessage },
        isBusinessError: false,
        options: _options,
      })
    }

    // 如果仅要求返回整个响应 JSON
    if (responseReturn === 'body') {
      return new Response(JSON.stringify(json), response)
    }

    // data 模式：提取指定字段并校验业务 code
    const dataConfig = responseReturnConfig as Extract<ResponseParserOptions, { responseReturn: 'data' }>
    const {
      codeField = 'code',
      dataField = 'data',
      successCode = 0,
      errorCodeField,
      errorMessageField = 'message',
    } = dataConfig

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
        isBusinessError: true,
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
