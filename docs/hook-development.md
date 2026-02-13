# Hook 开发指南

[← 返回 CLAUDE.md](../CLAUDE.md)

本文档介绍如何开发自定义 Hook，包括推荐模式、高级用法和实际场景示例。

---

## 推荐模式：Hook 工厂函数

### 为什么使用工厂函数？

- ✅ 支持配置参数（灵活性）
- ✅ 支持条件逻辑（动态行为）
- ✅ 支持闭包状态（如缓存、计数器）
- ✅ 便于测试和复用

### 基础示例

```typescript
import type { BeforeRequestHook } from 'ky'

// ✅ 推荐：使用工厂函数，支持配置
function createCustomHeaderHook(config: {
  headerName: string
  getValue: () => string | Promise<string>
  condition?: (request: Request) => boolean
}): BeforeRequestHook {
  return async (request: globalThis.Request, options: any) => {
    // 条件性执行
    if (config.condition && !config.condition(request)) {
      return
    }

    // 动态获取值
    const value = await config.getValue()
    if (value) {
      request.headers.set(config.headerName, value)
    }

    // ⚠️ 不要返回新的 Request（会破坏 WeakMap 缓存）
    // ❌ return new Request(request, { headers: ... })
    // ✅ 直接修改 headers
  }
}

// 使用示例
const http = createClient({
  extendedHooks: {
    beforeRequest: {
      append: [
        createCustomHeaderHook({
          headerName: 'X-Request-ID',
          getValue: () => crypto.randomUUID(),
          condition: (req) => req.method !== 'GET', // 只对非 GET 请求添加
        }),
      ],
    },
  },
})
```

## 高级模式：带状态的 Hook

```typescript
import type { BeforeRequestHook } from 'ky'

// 请求计数器 Hook
function createRequestCounterHook(options: {
  onThreshold?: (count: number) => void
  threshold?: number
}): BeforeRequestHook {
  let requestCount = 0 // 闭包状态

  return async (request: globalThis.Request) => {
    requestCount++
    request.headers.set('X-Request-Count', String(requestCount))

    // 达到阈值时触发回调
    if (options.threshold && requestCount >= options.threshold) {
      options.onThreshold?.(requestCount)
    }
  }
}
```

## afterResponse Hook 模式

```typescript
import type { AfterResponseHook } from 'ky'

// 响应日志 Hook
function createResponseLoggerHook(config: {
  logLevel: 'info' | 'debug'
  filter?: (response: Response) => boolean
}): AfterResponseHook {
  return async (request, options, response) => {
    // 条件性执行
    if (config.filter && !config.filter(response)) {
      return response
    }

    // 需要读取 body 时先 clone
    const cloned = response.clone()
    const data = await cloned.json().catch(() => null)

    // 日志记录
    if (config.logLevel === 'debug') {
      console.debug('[Response]', {
        url: request.url,
        status: response.status,
        data,
      })
    }

    // 必须返回原始 Response 对象
    return response
  }
}
```

## 简单 Hook（不需要配置时）

```typescript
import type { BeforeRequestHook } from 'ky'

// 简单场景：直接导出 Hook 函数
export const timestampHook: BeforeRequestHook = async (request) => {
  request.headers.set('X-Timestamp', Date.now().toString())
}

// 使用
const http = createClient({
  extendedHooks: {
    beforeRequest: { append: [timestampHook] },
  },
})
```

## 实际场景示例

### 场景 1：请求 ID 追踪

```typescript
function createRequestIdHook() {
  return async (request: Request) => {
    request.headers.set('X-Request-ID', crypto.randomUUID())
  }
}

const http = createClient({
  extendedHooks: {
    beforeRequest: { append: [createRequestIdHook()] },
  },
})
```

### 场景 2：条件性日志记录

```typescript
// 只在开发环境记录请求日志
function createDevLoggerHook(enabled: boolean) {
  if (!enabled) {
    return async () => {} // 返回空 Hook
  }

  return async (request: Request, options: any, response: Response) => {
    const cloned = response.clone()
    const data = await cloned.json().catch(() => null)

    console.log('[API]', {
      method: request.method,
      url: request.url,
      status: response.status,
      data,
    })

    return response
  }
}

const http = createClient({
  extendedHooks: {
    afterResponse: {
      append: [createDevLoggerHook(process.env.NODE_ENV === 'development')],
    },
  },
})
```

### 场景 3：动态 Header 注入

```typescript
// 根据请求 URL 动态添加不同的 headers
function createDynamicHeaderHook(config: {
  rules: Array<{
    pattern: RegExp
    headers: Record<string, string>
  }>
}) {
  return async (request: Request) => {
    const url = request.url

    for (const rule of config.rules) {
      if (rule.pattern.test(url)) {
        Object.entries(rule.headers).forEach(([key, value]) => {
          request.headers.set(key, value)
        })
        break
      }
    }
  }
}

const http = createClient({
  extendedHooks: {
    beforeRequest: {
      append: [
        createDynamicHeaderHook({
          rules: [
            {
              pattern: /\/api\/v1\//,
              headers: { 'X-API-Version': 'v1' },
            },
            {
              pattern: /\/api\/v2\//,
              headers: { 'X-API-Version': 'v2' },
            },
          ],
        }),
      ],
    },
  },
})
```

### 场景 4：性能监控

```typescript
// 监控请求耗时
function createPerformanceHook(options: {
  onSlow?: (duration: number, url: string) => void
  threshold?: number
}) {
  const startTimes = new WeakMap<Request, number>()

  return {
    beforeRequest: async (request: Request) => {
      startTimes.set(request, Date.now())
    },
    afterResponse: async (request: Request, _options: any, response: Response) => {
      const startTime = startTimes.get(request)
      if (startTime) {
        const duration = Date.now() - startTime

        if (options.threshold && duration > options.threshold) {
          options.onSlow?.(duration, request.url)
        }

        startTimes.delete(request)
      }

      return response
    },
  }
}

const perfHook = createPerformanceHook({
  threshold: 1000, // 1 秒
  onSlow: (duration, url) => {
    console.warn(`Slow request: ${url} took ${duration}ms`)
  },
})

const http = createClient({
  extendedHooks: {
    beforeRequest: { append: [perfHook.beforeRequest] },
    afterResponse: { append: [perfHook.afterResponse] },
  },
})
```

## 编码规范

### 命名约定

- Hook 工厂函数：`createXxxHook`
- Hook 函数：`xxxHook`
- 配置参数：使用对象，支持可选参数

### 类型定义

```typescript
import type { BeforeRequestHook, AfterResponseHook } from 'ky'

// 总是明确类型
function createMyHook(config: MyConfig): BeforeRequestHook {
  return async (request, options) => {
    // ...
  }
}
```

### 错误处理

```typescript
function createSafeHook(): BeforeRequestHook {
  return async (request) => {
    try {
      // Hook 逻辑
    } catch (error) {
      // 记录错误但不阻塞请求
      console.error('[Hook Error]', error)
    }
  }
}
```

---

## 相关文档

- [设计决策](./design-decisions.md) - 了解 Hook 系统的设计理由
- [架构设计](./architecture.md) - 了解 Hook 系统的实现细节
- [常见陷阱](./pitfalls.md) - 避免 Hook 开发中的常见错误
- [约束和限制](./constraints.md) - 了解 Hook 系统的限制

[← 返回 CLAUDE.md](../CLAUDE.md)
