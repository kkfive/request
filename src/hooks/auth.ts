import type { BeforeRequestHook } from 'ky'
import type { AuthConfig } from '../types'

/**
 * 创建认证 Hook
 * 自动注入 token 和额外 headers
 *
 * 注：401 重试由 unauthorized hook 通过 ky 原生 `ky.retry()` 完成，
 * ky 内部负责重发与 body 处理，因此此处无需再克隆/缓存请求 body。
 */
function createAuthHook(
  auth?: AuthConfig,
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>,
): BeforeRequestHook {
  return async ({ request }) => {
    // 处理 auth token 注入
    if (auth?.getToken) {
      const token = await auth.getToken()
      if (token) {
        const headerName = auth.headerName ?? 'Authorization'
        const scheme = auth.scheme === undefined ? 'Bearer' : auth.scheme
        const headerValue = scheme ? `${scheme} ${token}` : token
        request.headers.set(headerName, headerValue)
      }
    }

    // 处理额外 headers 注入
    if (getHeaders) {
      const headers = await getHeaders()
      if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
          if (value) {
            request.headers.set(key, value)
          }
        })
      }
    }
  }
}

export { createAuthHook }
