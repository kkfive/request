import type { AfterResponseHook, BeforeRequestHook } from 'ky'

/**
 * 内置 Hook 名称
 */
type BuiltInHookName = 'paramsSerializer' | 'auth' | 'contentType' | 'unauthorized' | 'responseParser'

/**
 * 内置 Hooks 功能开关配置
 * 用于简单场景下控制内置 hook 的启用/禁用
 */
interface BuiltInHooksConfig {
  /**
   * 是否启用参数序列化 hook
   * @default true
   */
  enableParamsSerializer?: boolean
  /**
   * 是否启用认证 hook
   * @default true
   */
  enableAuth?: boolean
  /**
   * 是否启用 Content-Type 自动设置 hook
   * @default true
   */
  enableContentType?: boolean
  /**
   * 是否启用 401 未授权处理 hook
   * @default true
   */
  enableUnauthorizedHandler?: boolean
  /**
   * 是否启用响应解析 hook
   * @default true
   */
  enableResponseParser?: boolean
}

/**
 * Hook 控制配置
 * 用于高级场景下精细控制 hook 的行为
 */
interface HookControl {
  /**
   * 禁用指定的内置 hooks
   */
  disable?: BuiltInHookName[]
  /**
   * 替换指定的内置 hooks
   */
  replace?: Partial<Record<BuiltInHookName, BeforeRequestHook | AfterResponseHook>>
}

/**
 * Hook 数组配置
 * 支持简单数组或带 prepend/append 的对象形式
 */
type HookArrayConfig<T> = T[] | {
  /**
   * 在内置 hooks 之前插入
   */
  prepend?: T[]
  /**
   * 在内置 hooks 之后追加
   */
  append?: T[]
}

/**
 * 扩展的 Hooks 配置
 * 支持更灵活的 hook 控制
 */
interface ExtendedHooks {
  /**
   * 请求前 hooks
   */
  beforeRequest?: HookArrayConfig<BeforeRequestHook>
  /**
   * 响应后 hooks
   */
  afterResponse?: HookArrayConfig<AfterResponseHook>
  /**
   * Hook 控制配置（高级）
   */
  control?: HookControl
}

export type {
  BuiltInHookName,
  BuiltInHooksConfig,
  ExtendedHooks,
  HookArrayConfig,
  HookControl,
}
