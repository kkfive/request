/**
 * Mock handlers for testing
 * 模拟不同的 HTTP 响应场景
 */

export interface MockResponse {
  status: number
  body: any
  headers?: Record<string, string>
}

/**
 * 创建成功的响应
 */
export function createSuccessResponse(data: string = 'mock-data'): MockResponse {
  return {
    status: 200,
    body: {
      success: true,
      data,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  }
}

/**
 * 创建业务错误响应 (HTTP 200 但业务失败)
 */
export function createBusinessErrorResponse(errorCode = 500, errorMessage = 'Business Error'): MockResponse {
  return {
    status: 200,
    body: {
      success: false,
      errorCode,
      errorMessage,
      data: null,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  }
}

/**
 * 创建 HTTP 错误响应
 */
export function createHttpErrorResponse(status = 500, message = 'Internal Server Error'): MockResponse {
  return {
    status,
    body: {
      error: message,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  }
}

/**
 * 模拟路由映射
 */
export const mockRoutes: Record<string, MockResponse> = {
  '/success': createSuccessResponse(),
  '/success/query?foo=123&bar=456': createSuccessResponse('query-ok'),
  '/error/business/500': createBusinessErrorResponse(),
  '/error/http/500': createHttpErrorResponse(),
}
