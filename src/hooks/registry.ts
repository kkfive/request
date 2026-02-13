import type { AfterResponseHook, BeforeRequestHook, Hooks, KyInstance } from 'ky'
import type { BuiltInHookName, BuiltInHooksConfig, ExtendedHooks, HookArrayConfig, RequestConfig } from '../types'
import {
  createAuthHook,
  createContentTypeHook,
  createResponseParserHook,
  createUnauthorizedHook,
  paramsSerializerHook,
} from './builtin'

/**
 * 解析 Hook 数组配置
 */
function resolveHookArray<T>(config: HookArrayConfig<T> | undefined): { prepend: T[], append: T[] } {
  if (!config) {
    return { prepend: [], append: [] }
  }
  if (Array.isArray(config)) {
    return { prepend: [], append: config }
  }
  return {
    prepend: config.prepend ?? [],
    append: config.append ?? [],
  }
}

/**
 * 检查 hook 是否被禁用
 */
function isHookDisabled(
  name: BuiltInHookName,
  features?: BuiltInHooksConfig,
  control?: ExtendedHooks['control'],
): boolean {
  // 检查 control.disable 数组
  if (control?.disable?.includes(name)) {
    return true
  }

  // 检查 features 开关
  if (features) {
    switch (name) {
      case 'paramsSerializer':
        return features.enableParamsSerializer === false
      case 'auth':
        return features.enableAuth === false
      case 'contentType':
        return features.enableContentType === false
      case 'unauthorized':
        return features.enableUnauthorizedHandler === false
      case 'responseParser':
        return features.enableResponseParser === false
    }
  }

  return false
}

/**
 * 获取替换的 hook
 */
function getReplacementHook<T>(
  name: BuiltInHookName,
  control?: ExtendedHooks['control'],
): T | undefined {
  return control?.replace?.[name] as T | undefined
}

/**
 * 解析并构建最终的 hooks 配置
 */
function resolveHooks(config: RequestConfig, getKyInstance?: () => KyInstance): Hooks {
  const { features, extendedHooks, auth, getHeaders, onUnauthorized, responseParser, hooks } = config

  const control = extendedHooks?.control

  // 解析用户 hooks
  const beforeRequestConfig = resolveHookArray(extendedHooks?.beforeRequest)
  const afterResponseConfig = resolveHookArray(extendedHooks?.afterResponse)

  // 兼容旧的 hooks 配置
  const legacyBeforeRequest = hooks?.beforeRequest ?? []
  const legacyAfterResponse = hooks?.afterResponse ?? []

  // 构建 beforeRequest hooks
  const beforeRequest: BeforeRequestHook[] = [
    ...beforeRequestConfig.prepend,
  ]

  // paramsSerializer hook
  if (!isHookDisabled('paramsSerializer', features, control)) {
    const replacement = getReplacementHook<BeforeRequestHook>('paramsSerializer', control)
    beforeRequest.push(replacement ?? paramsSerializerHook)
  }

  // auth hook
  if (!isHookDisabled('auth', features, control) && (auth || getHeaders)) {
    const replacement = getReplacementHook<BeforeRequestHook>('auth', control)
    beforeRequest.push(replacement ?? createAuthHook(auth, getHeaders))
  }

  // contentType hook
  if (!isHookDisabled('contentType', features, control)) {
    const replacement = getReplacementHook<BeforeRequestHook>('contentType', control)
    beforeRequest.push(replacement ?? createContentTypeHook())
  }

  // 添加用户 append hooks 和兼容旧配置
  beforeRequest.push(...beforeRequestConfig.append, ...legacyBeforeRequest)

  // 构建 afterResponse hooks
  const afterResponse: AfterResponseHook[] = [
    ...afterResponseConfig.prepend,
  ]

  // unauthorized hook
  if (!isHookDisabled('unauthorized', features, control)) {
    const replacement = getReplacementHook<AfterResponseHook>('unauthorized', control)
    afterResponse.push(replacement ?? createUnauthorizedHook(onUnauthorized, auth, getKyInstance))
  }

  // responseParser hook
  if (responseParser && !isHookDisabled('responseParser', features, control)) {
    const replacement = getReplacementHook<AfterResponseHook>('responseParser', control)
    afterResponse.push(replacement ?? createResponseParserHook())
  }

  // 添加用户 append hooks 和兼容旧配置
  afterResponse.push(...afterResponseConfig.append, ...legacyAfterResponse)

  return {
    beforeRequest,
    afterResponse,
    beforeError: hooks?.beforeError,
    beforeRetry: hooks?.beforeRetry,
  }
}

export { resolveHooks }
