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

// SSE 流式请求
export { createSSEStream, createSSEStreamFromResponse, sse, SSEStream } from './sse'

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

// SSE 类型
export type {
  SSECloseHandler,
  SSEConfig,
  SSEErrorHandler,
  SSEEvent,
  SSEEventHandler,
  SSEFromResponseOptions,
  SSEStream as SSEStreamType,
} from './types'

// 工具函数
export { to } from './utils'
