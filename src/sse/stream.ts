import type { KyInstance } from 'ky'
import type {
  SSEStream as ISSEStream,
  SSECloseHandler,
  SSEConfig,
  SSEErrorHandler,
  SSEEvent,
  SSEEventHandler,
  SSEFromResponseOptions,
} from './types'
import { parseServerSentEvents } from 'parse-sse'

interface ListenerMap<T> {
  data: Set<SSEEventHandler<T>>
  error: Set<SSEErrorHandler>
  close: Set<SSECloseHandler>
}

type ConsumeFn = () => Promise<void>

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

  get response(): Response | undefined {
    return this._response
  }

  get done(): Promise<void> {
    return this._done
  }

  cancel(): void {
    this.abortController.abort()
  }

  // --- Emitter ---

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
  async consumeFromKy(kyInstance: KyInstance, url: string, config?: SSEConfig): Promise<void> {
    try {
      let resolvedUrl = url
      if (resolvedUrl.startsWith('/'))
        resolvedUrl = resolvedUrl.slice(1)

      const response = await kyInstance(resolvedUrl, {
        method: config?.method ?? 'POST',
        json: config?.body,
        headers: {
          Accept: 'text/event-stream',
          ...config?.headers,
        },
        signal: this.abortController.signal,
        timeout: config?.timeout ?? false,
      })

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

function createSSEStreamFromResponse<T = unknown>(
  response: Response,
  options?: SSEFromResponseOptions,
): ISSEStream<T> {
  const stream = new SSEStream<T>(options)
  stream.setConsumeFn(() => stream.consumeFromResponse(response))
  return stream
}

// --- 高层：封装 ky 请求 ---

function createSSEStream<T = unknown>(
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

// --- 快捷函数 ---

function sse<T = unknown>(kyInstance: KyInstance, url: string, data?: unknown, config?: SSEConfig): ISSEStream<T> {
  return createSSEStream<T>(kyInstance, url, data, config)
}

export { createSSEStream, createSSEStreamFromResponse, sse, SSEStream }
