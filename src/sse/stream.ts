import type { KyInstance } from 'ky'
import type { RequestConfig } from '../types'
import type {
  SSEStream as ISSEStream,
  SSECloseHandler,
  SSEConfig,
  SSEErrorHandler,
  SSEEvent,
  SSEEventHandler,
  SSEFromResponseOptions,
  SSERequestConfig,
} from './types'
import { parseServerSentEvents } from 'parse-sse'

interface ListenerMap<T> {
  data: Set<SSEEventHandler<T>>
  error: Set<SSEErrorHandler>
  close: Set<SSECloseHandler>
}

type ConsumeFn = () => Promise<void>

/**
 * SSE 流对象。由 `client.sse()` / {@link createSSEStreamFromResponse} 创建，
 * 一般不直接 `new`。支持两种消费方式，二选一（流只能被消费一次）：
 * - **async iteration**：`for await (const event of stream) { ... }`
 * - **emitter**：`stream.on('data' | 'error' | 'close', handler)`，配合 `await stream.done`
 */
class SSEStream<T = unknown> implements ISSEStream<T> {
  private abortController: AbortController
  private _response?: Response
  private _doneResolve!: () => void
  private _doneReject!: (error: Error) => void
  private readonly _done: Promise<void>

  private listeners: ListenerMap<T> = {
    data: new Set(),
    error: new Set(),
    close: new Set(),
  }

  private parserMode: 'json' | 'text'
  private doneSignal: string | null
  private consumeFn: ConsumeFn | null = null
  private consuming = false

  constructor(options?: { signal?: AbortSignal, parser?: 'json' | 'text', doneSignal?: string | null }) {
    this.parserMode = options?.parser ?? 'json'
    this.doneSignal = options?.doneSignal === undefined ? '[DONE]' : options.doneSignal

    this.abortController = new AbortController()
    if (options?.signal) {
      options.signal.addEventListener('abort', () => this.abortController.abort())
    }

    this._done = new Promise<void>((resolve, reject) => {
      this._doneResolve = resolve
      this._doneReject = reject
    }).catch(() => { }) as Promise<void>
  }

  /** 底层 `Response` 对象（请求发出后可用），可读取响应头、状态码等。 */
  get response(): Response | undefined {
    return this._response
  }

  /** 流消费完成（正常结束或出错）后 resolve 的 Promise；emitter 模式下用 `await stream.done` 等待结束。 */
  get done(): Promise<void> {
    return this._done
  }

  /** 主动取消流（中止底层请求）。 */
  cancel(): void {
    this.abortController.abort()
  }

  // --- Emitter ---

  /**
   * 注册事件监听器（emitter 模式）。首次调用会惰性启动流消费。
   * - `data`：收到一条 SSE 事件
   * - `error`：消费过程出错
   * - `close`：流正常结束
   * @returns 自身，支持链式调用
   */
  on(event: 'data', handler: SSEEventHandler<T>): this
  on(event: 'error', handler: SSEErrorHandler): this
  on(event: 'close', handler: SSECloseHandler): this
  on(event: string, handler: (...args: any[]) => void): this {
    const set = (this.listeners as any)[event]
    if (set)
      set.add(handler)
    this.tryStart()
    return this
  }

  off(event: 'data', handler: SSEEventHandler<T>): this
  off(event: 'error', handler: SSEErrorHandler): this
  off(event: 'close', handler: SSECloseHandler): this
  off(event: string, handler: (...args: any[]) => void): this {
    const set = (this.listeners as any)[event]
    if (set)
      set.delete(handler)
    return this
  }

  private emit(event: 'data', data: SSEEvent<T>): void
  private emit(event: 'error', error: Error): void
  private emit(event: 'close'): void
  private emit(event: 'data' | 'error' | 'close', ...args: unknown[]): void {
    const handlers = this.listeners[event]
    if (!handlers)
      return
    for (const handler of handlers) {
      (handler as (...a: unknown[]) => void)(...args)
    }
  }

  // --- 消费源注册 ---

  /**
   * 设置消费函数，由工厂方法调用
   */
  setConsumeFn(fn: ConsumeFn): void {
    this.consumeFn = fn
  }

  /**
   * 惰性启动消费
   */
  private tryStart(): void {
    if (this.consuming || !this.consumeFn)
      return
    this.consuming = true
    this.consumeFn().catch(() => { })
  }

  // --- 消费实现 ---

  /**
   * 从 Response 消费 SSE 流
   */
  async consumeFromResponse(response: Response): Promise<void> {
    this._response = response

    try {
      if (!response.body) {
        this.emit('close')
        this._doneResolve()
        return
      }

      const eventStream = parseServerSentEvents(response)

      for await (const sseEvent of eventStream) {
        if (this.abortController.signal.aborted)
          break

        if (this.processEvent(sseEvent.data, sseEvent.type, sseEvent.lastEventId, sseEvent.retry))
          break
      }

      this.emit('close')
      this._doneResolve()
    }
    catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.emit('close')
        this._doneResolve()
        return
      }
      const err = error instanceof Error ? error : new Error(String(error))
      this.emit('error', err)
      this._doneReject!(err)
    }
  }

  /**
   * 使用 ky 实例发起请求并消费 SSE 流
   */
  async consumeFromKy(kyInstance: KyInstance, url: string, config?: SSERequestConfig): Promise<void> {
    try {
      let resolvedUrl = url
      if (resolvedUrl.startsWith('/'))
        resolvedUrl = resolvedUrl.slice(1)

      const requestConfig: RequestConfig = {
        method: config?.method ?? 'POST',
        json: config?.body,
        headers: {
          Accept: 'text/event-stream',
          ...config?.headers,
        },
        responseParser: { responseReturn: 'raw' },
        signal: this.abortController.signal,
        timeout: config?.timeout ?? false,
      }

      const response = await kyInstance(resolvedUrl, requestConfig)

      await this.consumeFromResponse(response)
    }
    catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.emit('close')
        this._doneResolve()
        return
      }
      const err = error instanceof Error ? error : new Error(String(error))
      this.emit('error', err)
      this._doneReject!(err)
    }
  }

  // --- Async Iterator ---

  async* [Symbol.asyncIterator](): AsyncIterator<SSEEvent<T>> {
    if (this.consuming)
      throw new Error('[kk-request] SSEStream can only be iterated once')

    // 启动消费
    this.consuming = true
    this.consumeFn?.().catch(() => { })

    const eventQueue: SSEEvent<T>[] = []
    let resolveNext: (() => void) | null = null
    let finished = false
    let iterError: Error | null = null

    const dataHandler: SSEEventHandler<T> = (event) => {
      eventQueue.push(event)
      resolveNext?.()
    }
    const closeHandler: SSECloseHandler = () => {
      finished = true
      resolveNext?.()
    }
    const errorHandler: SSEErrorHandler = (err) => {
      iterError = err
      finished = true
      resolveNext?.()
    }

    this.listeners.data.add(dataHandler)
    this.listeners.close.add(closeHandler)
    this.listeners.error.add(errorHandler)

    try {
      while (true) {
        if (eventQueue.length === 0 && !finished)
          await new Promise<void>((r) => { resolveNext = r })

        if (iterError)
          throw iterError
        if (eventQueue.length === 0)
          break

        yield eventQueue.shift()!
      }
    }
    finally {
      this.listeners.data.delete(dataHandler)
      this.listeners.close.delete(closeHandler)
      this.listeners.error.delete(errorHandler)
    }
  }

  // --- Internal ---

  private processEvent(rawData: string, type: string, lastEventId: string, retry: number | undefined): boolean {
    if (this.doneSignal && rawData === this.doneSignal)
      return true

    const data = this.parseData(rawData)
    this.emit('data', {
      event: type === 'message' ? undefined : type,
      data: data as T,
      id: lastEventId || undefined,
      retry,
    })
    return false
  }

  private parseData(raw: string): unknown {
    if (this.parserMode === 'text')
      return raw
    try {
      return JSON.parse(raw)
    }
    catch {
      return raw
    }
  }
}

// --- 底层：接收 Response ---

/**
 * 从一个已有的 `Response` 创建可消费的 SSE 流（底层 API）。
 *
 * 适用于已经有 `Response` 的高级场景：自行 `fetch`、第三方 SDK 返回 Response、
 * 或测试 fixture，然后交给本函数解析。
 *
 * @param response 一个 `text/event-stream` 的 Response（body 可读）
 * @param options SSE 解析配置：`parser` / `doneSignal` / `signal`
 * @example
 * ```typescript
 * import { createSSEStreamFromResponse } from '@kkfive/request'
 *
 * const response = await fetch('/sse/chat', {
 *   method: 'POST',
 *   headers: { 'X-Custom': 'value' },
 *   body: JSON.stringify({ messages }),
 * })
 * const stream = createSSEStreamFromResponse(response)
 * for await (const event of stream)
 *   console.log(event.data)
 * ```
 */
function createSSEStreamFromResponse<T = unknown>(
  response: Response,
  options?: SSEFromResponseOptions,
): ISSEStream<T> {
  const stream = new SSEStream<T>(options)
  stream.setConsumeFn(() => stream.consumeFromResponse(response))
  return stream
}

// --- 高层：封装 ky 请求 ---

/**
 * 发起 SSE 请求并返回可消费的流（内部 API）。
 *
 * 公共入口是 `client.sse(url, data, config)`；不要把 `client.raw` 暴露给用户作为
 * SSE 请求入口，否则调用方会被实例级 responseParser / schema 等普通 JSON 请求语义影响。
 */
function createSSEStreamForClient<T = unknown>(
  kyInstance: KyInstance,
  url: string,
  data?: unknown,
  config?: SSEConfig,
): ISSEStream<T> {
  const stream = new SSEStream<T>({
    signal: config?.signal,
    parser: config?.parser,
    doneSignal: config?.doneSignal,
  })
  stream.setConsumeFn(() => stream.consumeFromKy(kyInstance, url, { ...config, body: data }))
  return stream
}

export { createSSEStreamForClient, createSSEStreamFromResponse, SSEStream }
