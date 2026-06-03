/**
 * 测试用响应类型定义
 */

/**
 * 服务器响应基础接口
 */
interface BaseApiResponse {
  success?: boolean
  code?: number
  msg?: string
  message?: string
  errorCode?: number
  errorMessage?: string
}

/**
 * 成功响应接口 - data 字段必需
 */
export interface SuccessApiResponse<T> extends BaseApiResponse {
  success: true
  data: T
}

/**
 * 失败响应接口 - data 字段可选
 */
export interface ErrorApiResponse extends BaseApiResponse {
  success: false
  data?: never
}

/**
 * API 响应联合类型
 */
export type ApiResponse<T> = SuccessApiResponse<T> | ErrorApiResponse

/**
 * Echo 端点返回的数据结构
 */
export interface EchoData {
  method: string
  body?: unknown
  query?: Record<string, string>
  rawQuery?: string
  authorization?: string | null
  headers?: Record<string, string>
}

/**
 * FormData 端点返回的数据结构
 */
export interface FormDataData {
  isMultipart: boolean
  contentType: string
  fields: Record<string, string>
}

/**
 * FormData 响应完整结构
 */
export interface FormDataResponse {
  success: boolean
  data: FormDataData
}
