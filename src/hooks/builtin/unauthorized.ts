import type { AfterResponseHook, KyInstance } from 'ky'
import type { AuthConfig } from '../../types'
import { RequestError } from '../../errors/request-error'
import { requestBodyCache } from './auth'

// 创建一个可识别的 marker hook
async function retryMarkerHook(): Promise<void> {
  // No-op hook，仅用于标记
}

// 在 hook 函数上添加标记
(retryMarkerHook as any).__kkRetry = true

/**
 * 创建 401 未授权处理 Hook
 */
function createUnauthorizedHook(
  onUnauthorized?: () => void,
  auth?: AuthConfig,
  getKyInstance?: () => KyInstance,
): AfterResponseHook {
  // 使用闭包级别的 Promise，每个 hook 实例独立，避免多实例间的 token 混淆
  let refreshPromise: Promise<string> | null = null

  return async (request: globalThis.Request, options: any, response: Response) => {
    if (response.status === 401) {
      // 检查是否为 retry 请求
      const isRetryRequest = options.hooks?.beforeRequest?.some(
        (hook: any) => hook.__kkRetry === true,
      )

      if (isRetryRequest) {
        // 清理缓存，缩短 clone body 存活时间
        requestBodyCache.delete(request)
        // 重置状态，避免污染
        refreshPromise = null
        try {
          onUnauthorized?.()
        }
        catch (callbackError) {
          console.error('[kk-request] onUnauthorized callback error:', callbackError)
        }
        return response
      }

      // 尝试刷新 token
      if (auth?.refreshToken && getKyInstance) {
        // 阶段 1: 刷新 token
        let newToken: string
        let shouldTriggerCallback = false
        try {
          // 如果已有刷新请求，等待它完成；否则立即创建 Promise 占位，消除竞态窗口
          if (!refreshPromise) {
            shouldTriggerCallback = true // 标记为发起者
            refreshPromise = (async () => {
              const refreshToken = await auth.refreshToken!.getRefreshToken()
              return await auth.refreshToken!.refresh(refreshToken)
            })()
          }
          newToken = await refreshPromise
          refreshPromise = null
        }
        catch (error) {
          // 只在 refresh 失败时触发 onRefreshFail
          refreshPromise = null
          // 清理缓存，缩短 clone body 存活时间
          requestBodyCache.delete(request)
          // 只有发起者触发回调，避免并发请求重复触发
          if (shouldTriggerCallback) {
            try {
              auth.refreshToken.onRefreshFail?.(error instanceof Error ? error : new Error(String(error)))
            }
            catch (callbackError) {
              console.error('[kk-request] onRefreshFail callback error:', callbackError)
            }
            try {
              onUnauthorized?.()
            }
            catch (callbackError) {
              console.error('[kk-request] onUnauthorized callback error:', callbackError)
            }
          }
          return response
        }

        // 阶段 2: 触发成功回调（隔离在 try-catch 外，避免回调异常误判为 refresh 失败）
        if (shouldTriggerCallback) {
          try {
            // ✅ 修改：await 回调执行
            await auth.refreshToken.onRefreshSuccess?.(newToken)
          }
          catch (callbackError) {
            // 回调异常不影响 refresh 成功状态，仅记录错误
            console.error('[kk-request] onRefreshSuccess callback error:', callbackError)
          }
        }

        // 阶段 3: 重试请求
        // 创建新请求，让 auth hook 自然设置新 token
        const kyInstance = getKyInstance()

        // 尝试使用缓存的 body（如果有）
        const cachedRequest = requestBodyCache.get(request)
        const sourceRequest = cachedRequest || request

        // 检查 body 是否可用
        if (sourceRequest.bodyUsed && sourceRequest.body) {
          console.warn('[kk-request] Cannot retry request with consumed body, skipping retry')
          // 清理缓存，缩短 clone body 存活时间
          requestBodyCache.delete(request)
          try {
            onUnauthorized?.()
          }
          catch (callbackError) {
            console.error('[kk-request] onUnauthorized callback error:', callbackError)
          }
          return response
        }

        const newRequest = new Request(sourceRequest, {
          headers: new Headers(sourceRequest.headers),
        })

        // 使用实例的 ky 重新发起请求，确保经过所有配置的 hooks
        // retry 失败会向外抛出，不触发 onRefreshFail
        // 在 retry 时注入 marker hook
        const retryResponse = await kyInstance(newRequest, {
          hooks: {
            beforeRequest: [retryMarkerHook],
          },
        })

        // 清理缓存
        requestBodyCache.delete(request)

        return retryResponse
      }

      // 无 refreshToken 配置，抛出 RequestError
      requestBodyCache.delete(request)
      try {
        onUnauthorized?.()
      }
      catch (callbackError) {
        console.error('[kk-request] onUnauthorized callback error:', callbackError)
      }

      // 抛出 RequestError 而不是返回 response
      const locale = (options as any).locale || 'zh'
      const errorMessages = {
        zh: '未授权或登录已过期',
        en: 'Unauthorized or session expired',
      }
      throw new RequestError(errorMessages[locale as keyof typeof errorMessages] || errorMessages.zh, {
        code: 401,
        response,
        isBusinessError: false,
        options: options as any,
      })
    }

    return response
  }
}

export { createUnauthorizedHook }
