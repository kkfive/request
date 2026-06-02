import type { AfterResponseHook } from 'ky'
import type { RequestConfig, ResponseParserDataConfig } from '../types'
import { BusinessError } from '../errors'
import { isFunction } from '../utils/predicates'

/**
 * 创建响应解析 Hook
 */
function createResponseParserHook(): AfterResponseHook {
  return async ({ options, response }) => {
    const _options = options as RequestConfig
    const responseReturnConfig = _options?.responseParser
    const { responseReturn = 'raw' } = responseReturnConfig ?? {}

    // 不处理任何内容，直接返回原始 Response
    if (!responseReturn || responseReturn === 'raw') {
      return response
    }

    // 非 2xx 交给 ky 抛出 HTTPError（携带 response/data 等完整信息）；401 已由 unauthorized hook 先行处理
    if (!response.ok) {
      return response
    }

    // 解析 JSON（clone 避免消费调用方的 body）
    const json: unknown = await response.clone().json()

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
      // 业务错误：HTTP 2xx 但业务 code 不符
      const errorMsg = isFunction(errorMessageField)
        ? errorMessageField(json)
        : (jsonObj?.[errorMessageField as string] as string) || (jsonObj?.msg as string) || 'API Response Failed'

      const errorCode = jsonObj?.[errorCodeField]

      throw new BusinessError(errorMsg, {
        code: errorCode as string | number,
        raw: json,
        response,
        options: _options,
      })
    }

    const data = isFunction(dataField)
      ? dataField(json)
      : jsonObj?.[dataField as string]

    return new Response(JSON.stringify(data), response)
  }
}

export { createResponseParserHook }
