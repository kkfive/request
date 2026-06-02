// Hook 系统类型
export type {
  BuiltInHookName,
  BuiltInHooksConfig,
  ExtendedHooks,
  HookArrayConfig,
  HookControl,
} from './hooks'

// 请求配置类型
export type {
  AuthConfig,
  CustomOptions,
  ExtendedOptions,
  LifecycleCallbacks,
  RequestConfig,
} from './options'

// 兼容旧类型名称
export type { AuthConfig as AuthOptions, RequestConfig as RequestOption } from './options'

// 响应解析类型
export type {
  BaseParserOptions,
  ResponseParserBodyConfig,
  ResponseParserConfig,
  ResponseParserDataConfig,
  ResponseParserRawConfig,
  ResponseReturnMode,
} from './response'
export type { ResponseParserConfig as ResponseParserOptions } from './response'
