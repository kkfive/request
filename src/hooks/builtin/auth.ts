import type { BeforeRequestHook } from 'ky'
import type { AuthConfig } from '../../types'

// 用于缓存请求 body 的 WeakMap，供 unauthorized hook 在 retry 时使用
const requestBodyCache = new WeakMap<globalThis.Request, globalThis.Request>()

/**
 * 创建认证 Hook
 * 自动注入 token 和额外 headers
 *
 * ⚠️ 重要限制：
 * 此 Hook 使用 WeakMap 缓存请求 body 以支持 401 retry。
 * 如果在 extendedHooks.beforeRequest.append 中返回新的 Request 实例，
 * 缓存会失效，导致 POST/PUT 请求的 retry 失败。
 *
 * 建议：只修改 Request 的 headers，不要替换整个 Request 对象。
 * 如果必须替换，请确保在 auth hook 之前执行。
 */
function createAuthHook(
  auth?: AuthConfig,
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>,
): BeforeRequestHook {
  return async (request: globalThis.Request, options: any) => {
    // 仅在启用 refreshToken 时克隆 body，避免不必要的内存开销
    // 对大文件上传（multipart/form-data）跳过克隆，避免内存压力
    if (
      auth?.refreshToken
      && request.method !== 'GET'
      && request.method !== 'HEAD'
      && request.body
    ) {
      // 使用 options.body 判断，更可靠（不依赖 Content-Type header）
      const isFormData = options?.body instanceof FormData
      // 跳过大文件上传场景（multipart/form-data）
      if (!isFormData) {
        try {
          const clonedRequest = request.clone()
          requestBodyCache.set(request, clonedRequest)
        }
        catch (error) {
          // 如果克隆失败（如 body 已被消费），记录警告但不阻塞请求
          console.warn('[kk-request] Failed to clone request body for retry:', error)
        }
      }
    }

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

export { createAuthHook, requestBodyCache }
