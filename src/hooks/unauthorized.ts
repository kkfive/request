import type { AfterResponseHook } from 'ky'
import type { AuthConfig } from '../types'
import ky from 'ky'

/**
 * 创建 401 未授权处理 Hook
 *
 * 重试机制基于 ky 原生 `ky.retry()`（afterResponse 强制重试）：
 * - ky 内部负责重发、重试计数与 body 处理，POST/FormData 同样适用（强制重试跳过 method 检查）
 * - 用 `retryCount` 判定是否为重试请求，无需 marker hook，也无需 WeakMap 缓存 body
 * - 闭包级 `refreshPromise` 负责并发 401 的 token 刷新去重（ky 不提供此能力，保留）
 */
function createUnauthorizedHook(
  onUnauthorized?: () => void,
  auth?: AuthConfig,
): AfterResponseHook {
  // 闭包级 Promise：并发 401 只刷新一次 token
  let refreshPromise: Promise<string> | null = null

  return async ({ request, response, retryCount }) => {
    if (response.status !== 401) {
      return response
    }

    // 已刷新并重试过仍是 401 → 放弃，触发回调，交给 ky 抛出 HTTPError(401)
    if (retryCount > 0) {
      safeInvoke(onUnauthorized, 'onUnauthorized')
      return response
    }

    // 首次 401 且配置了 refreshToken → 刷新 token 后重试
    if (auth?.refreshToken) {
      let newToken: string
      // 标记是否为本次刷新的发起者（每个请求独立），仅发起者触发回调
      let isInitiator = false
      try {
        // 已有刷新进行中则复用；否则立即创建 Promise 占位，消除并发竞态窗口
        if (!refreshPromise) {
          isInitiator = true
          refreshPromise = (async () => {
            const refreshToken = await auth.refreshToken!.getRefreshToken()
            return await auth.refreshToken!.refresh(refreshToken)
          })()
        }
        newToken = await refreshPromise
        refreshPromise = null
      }
      catch (error) {
        refreshPromise = null
        if (isInitiator) {
          safeInvoke(
            () => auth.refreshToken!.onRefreshFail?.(error instanceof Error ? error : new Error(String(error))),
            'onRefreshFail',
          )
          safeInvoke(onUnauthorized, 'onUnauthorized')
        }
        // 刷新失败：返回原始 401 响应，交由 ky 抛出 HTTPError
        return response
      }

      // 刷新成功回调（隔离在 try-catch 外，避免回调异常被误判为刷新失败）
      if (isInitiator) {
        await safeInvokeAsync(
          () => auth.refreshToken!.onRefreshSuccess?.(newToken),
          'onRefreshSuccess',
        )
      }

      // 用新 token 重发：显式写入 header（重试不会再执行 beforeRequest 的 auth hook）
      const headers = new Headers(request.headers)
      const headerName = auth.headerName ?? 'Authorization'
      const scheme = auth.scheme === undefined ? 'Bearer' : auth.scheme
      headers.set(headerName, scheme ? `${scheme} ${newToken}` : newToken)

      return ky.retry({
        request: new Request(request, { headers }),
        code: 'TOKEN_REFRESHED',
      })
    }

    // 未配置 refreshToken：触发回调后返回原始 401 响应，交给 ky 抛出 HTTPError(401)
    safeInvoke(onUnauthorized, 'onUnauthorized')
    return response
  }
}

/** 安全执行同步回调，异常仅记录不外抛 */
function safeInvoke(fn: (() => void) | undefined, label: string): void {
  if (!fn) {
    return
  }
  try {
    fn()
  }
  catch (callbackError) {
    console.error(`[kk-request] ${label} callback error:`, callbackError)
  }
}

/** 安全执行可能为异步的回调，异常仅记录不外抛 */
async function safeInvokeAsync(fn: () => void | Promise<void>, label: string): Promise<void> {
  try {
    await fn()
  }
  catch (callbackError) {
    console.error(`[kk-request] ${label} callback error:`, callbackError)
  }
}

export { createUnauthorizedHook }
