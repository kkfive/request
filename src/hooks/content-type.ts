import type { BeforeRequestHook } from 'ky'

/**
 * 创建 Content-Type Hook
 * FormData 请求必须交给 fetch 自动设置 Content-Type，以生成正确的 multipart boundary。
 * 非 FormData 请求仅在调用方没有设置 Content-Type 时补默认 JSON 类型。
 */
function createContentTypeHook(): BeforeRequestHook {
  return async ({ request, options }) => {
    // FormData 不允许沿用调用方/全局注入的 Content-Type，否则 multipart boundary 会丢失。
    if (options.body instanceof FormData) {
      const contentType = request.headers.get('Content-Type')
      if (contentType?.includes('multipart/form-data') && contentType.includes('boundary=')) {
        return
      }
      const headers = new Headers(request.headers)
      headers.delete('Content-Type')
      return new Request(request, { body: options.body, headers })
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
