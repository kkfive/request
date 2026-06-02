/**
 * SSE 事件（解析后的单个事件）
 */
interface SSEEvent<T = unknown> {
  /**
   * 事件类型，来自 `event:` 字段
   * @default 'message'
   */
  event?: string
  /**
   * 事件数据，来自 `data:` 字段
   * - parser: 'json' 时为 JSON 解析后的对象
   * - parser: 'text' 时为原始字符串
   */
  data: T
  /**
   * 事件 ID，来自 `id:` 字段，用于断线重连
   */
  id?: string
  /**
   * 重连间隔（ms），来自 `retry:` 字段
   */
  retry?: number
}

/**
 * SSE 事件监听器类型
 */
type SSEEventHandler<T = unknown> = (event: SSEEvent<T>) => void
type SSEErrorHandler = (error: Error) => void
type SSECloseHandler = () => void

/**
 * SSE 请求配置（高层 API：ky 请求 + SSE 解析）
 */
interface SSEConfig {
  /**
   * HTTP 方法
   * @default 'POST'
   */
  method?: string
  /**
   * 请求体，会自动 JSON 序列化
   */
  body?: unknown
  /**
   * 额外的请求 headers
   */
  headers?: Record<string, string>
  /**
   * data 字段的解析方式
   * - 'json': 解析为 JSON 对象（默认，适合 OpenAI/Anthropic 等格式）
   * - 'text': 保留原始字符串
   * @default 'json'
   */
  parser?: 'json' | 'text'
  /**
   * 流结束信号，当 data 字段值匹配此字符串时结束流
   * 设为 null 可禁用自动结束检测
   * @default '[DONE]'
   */
  doneSignal?: string | null
  /**
   * 用于取消请求的 AbortSignal
   */
  signal?: AbortSignal
  /**
   * 连接超时时间（ms）
   * 未指定时继承客户端的 timeout 配置
   */
  timeout?: number
}

/**
 * SSE 底层解析配置（接收已有 Response 时使用）
 */
interface SSEFromResponseOptions {
  /**
   * data 字段的解析方式
   * @default 'json'
   */
  parser?: 'json' | 'text'
  /**
   * 流结束信号，设为 null 禁用
   * @default '[DONE]'
   */
  doneSignal?: string | null
  /**
   * 用于取消的 AbortSignal
   */
  signal?: AbortSignal
}

/**
 * SSE 流连接对象
 * 支持异步迭代、emitter 监听和手动取消
 */
interface SSEStream<T = unknown> {
  /**
   * 异步迭代器
   */
  [Symbol.asyncIterator]: () => AsyncIterator<SSEEvent<T>>

  /**
   * 注册事件监听器
   * - 'data': 收到 SSE 事件
   * - 'error': 发生错误
   * - 'close': 流结束
   */
  on: ((event: 'data', handler: SSEEventHandler<T>) => this) & ((event: 'error', handler: SSEErrorHandler) => this) & ((event: 'close', handler: SSECloseHandler) => this)

  /**
   * 移除事件监听器
   */
  off: ((event: 'data', handler: SSEEventHandler<T>) => this) & ((event: 'error', handler: SSEErrorHandler) => this) & ((event: 'close', handler: SSECloseHandler) => this)

  /**
   * 取消 SSE 连接
   */
  cancel: () => void

  /**
   * 原始 Response 对象
   */
  response?: Response

  /**
   * 流正常结束时 resolve，出错时 reject
   */
  done: Promise<void>
}

export type {
  SSECloseHandler,
  SSEConfig,
  SSEErrorHandler,
  SSEEvent,
  SSEEventHandler,
  SSEFromResponseOptions,
  SSEStream,
}
