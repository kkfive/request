// 核心导出
export { createClient, Request } from './core/client'

// 错误类
export { RequestError } from './errors/request-error'

// 内置 hooks（供高级用户使用）
export {
  createAuthHook,
  createContentTypeHook,
  createResponseParserHook,
  createUnauthorizedHook,
  paramsSerializerHook,
} from './hooks'

// 类型导出
export type {
  AuthConfig,
  AuthOptions,
  BuiltInHookName,
  BuiltInHooksConfig,
  ExtendedHooks,
  HookArrayConfig,
  HookControl,
  LifecycleCallbacks,
  RequestConfig,
  RequestOption,
  ResponseParserBodyConfig,
  ResponseParserConfig,
  ResponseParserDataConfig,
  ResponseParserOptions,
  ResponseParserRawConfig,
  ResponseReturnMode,
} from './types'

// 工具函数
export { to } from './utils'
