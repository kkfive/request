import type { AfterResponseHook } from 'ky'
import type { RequestConfig, ResponseParserDataConfig } from '../../types'
import { RequestError } from '../../errors/request-error'
import { isFunction } from '../../utils/predicates'

/**
 * 错误消息国际化配置
 */
const errorMessages = {
  zh: {
    400: '请求参数错误',
    401: '未授权或登录已过期',
    403: '没有权限访问该资源',
    404: '请求的资源不存在',
    500: '服务器内部错误',
    default: '网络错误',
    businessError: '接口响应失败',
  },
  en: {
    400: 'Bad Request',
    401: 'Unauthorized or session expired',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    default: 'Network Error',
    businessError: 'API Response Failed',
  },
} as const

/**
 * 创建响应解析 Hook
 */
function createResponseParserHook(): AfterResponseHook {
  return async (_request, options, response) => {
    const _options = options as RequestConfig
    const responseReturnConfig = _options?.responseParser
    const { responseReturn = 'raw' } = responseReturnConfig!

    // 不处理任何内容，直接返回原始 Response
    if (!responseReturn || responseReturn === 'raw') {
      return response
    }

    const _response = response.clone()

    if (!response.ok) {
      const { message, code } = formatNetworkError(_response, _options.locale)
      throw new RequestError(message, {
        code,
        response,
        raw: await _response.json().catch(() => ({})),
        isBusinessError: false,
        options: _options,
      })
    }

    // 解析 JSON，只在需要时执行
    const json: unknown = await _response.json()

    // 如果仅要求返回整个响应 JSON
    if (responseReturn === 'body') {
      return new Response(JSON.stringify(json), response)
    }

    const {
      codeField = 'code',
      dataField = 'data',
      successCode = 0,
      errorCodeField = 'code',
      errorMessageField = 'message',
    } = responseReturnConfig as ResponseParserDataConfig

    const jsonObj = json as Record<string, unknown>
    const code = jsonObj?.[codeField]
    const isSuccess = isFunction(successCode)
      ? successCode(code)
      : code === successCode

    if (!isSuccess) {
      const locale = _options.locale || 'zh'
      const errorMsg = isFunction(errorMessageField)
        ? errorMessageField(json)
        : (jsonObj?.[errorMessageField as string] as string) || (jsonObj?.msg as string) || errorMessages[locale].businessError

      const errorCode = jsonObj?.[errorCodeField]

      throw new RequestError(errorMsg, {
        isBusinessError: false,
        options: _options,
        code: errorCode as string | number,
        raw: json,
        response,
      })
    }

    const data = isFunction(dataField)
      ? dataField(json)
      : jsonObj?.[dataField as string]

    return new Response(JSON.stringify(data), response)
  }
}

function formatNetworkError(response: Response, locale: 'zh' | 'en' = 'zh'): { message: string, code: number } {
  const messages = errorMessages[locale]
  const status = response.status
  const message = messages[status as keyof typeof messages] || `${messages.default}: ${status}`
  return { message, code: status }
}

export { createResponseParserHook }
