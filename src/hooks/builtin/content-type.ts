import type { BeforeRequestHook } from 'ky'

/**
 * 创建 Content-Type Hook
 * 仅当请求没有设置 Content-Type 且请求体不是 FormData 时设置默认值
 */
function createContentTypeHook(): BeforeRequestHook {
  return (request: globalThis.Request, options: { body?: unknown }) => {
    // FormData 不需要设置 Content-Type，让浏览器/fetch 自动设置（包含 boundary）
    if (options.body instanceof FormData) {
      return
    }
    // 如果已经设置了 Content-Type，不做任何处理
    if (request.headers.has('Content-Type')) {
      return
    }
    // 对于非 FormData 请求，设置默认的 JSON Content-Type
    request.headers.set('Content-Type', 'application/json;charset=utf-8')
  }
}

export { createContentTypeHook }
