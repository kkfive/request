// 核心导出
export { createClient, Request } from './client'

// 业务错误类
export { BusinessError } from './errors'

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

// SSE 类型
export type {
  SSECloseHandler,
  SSEConfig,
  SSEErrorHandler,
  SSEEvent,
  SSEEventHandler,
  SSEFromResponseOptions,
  SSEStream as SSEStreamType,
} from './sse/types'

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

// ky 传输层错误类型与类型守卫（透传，便于消费方获取完整错误信息）
export {
  ForceRetryError,
  HTTPError,
  isForceRetryError,
  isHTTPError,
  isKyError,
  isNetworkError,
  isTimeoutError,
  KyError,
  NetworkError,
  TimeoutError,
} from 'ky'
