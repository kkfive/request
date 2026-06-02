# 工作流：添加自定义 Hook

[← SKILL.md](../SKILL.md)

本文给出编写自定义 Hook 的步骤、推荐模式与实战场景。动手前先读硬规则 [../rules/hook-authoring.md](../rules/hook-authoring.md)。

> ⚠️ ky 2.0 的 hook 采用 **state 对象**签名 `({ request, options, response, retryCount }) => ...`，本文示例均如此。

## 步骤

1. **确认职责落在边界内**（[../rules/boundaries.md](../rules/boundaries.md)）—— 缓存/重试/去重交给专业工具，不写成 hook。
2. **选阶段**：改请求（注入 header / 参数）→ `beforeRequest`；改/观测响应 → `afterResponse`。
3. **选形态**：需配置/状态 → 工厂函数 `createXxxHook`；无需配置 → 直接导出 `xxxHook`。
4. **遵守硬规则**：state 签名 / 读 body 前 clone / 返回 Response / 不改 options。
5. **注册**：通过 `extendedHooks.{beforeRequest,afterResponse}.{prepend,append}` 挂载（执行顺序见硬规则）。

## 推荐模式：工厂函数

工厂函数支持配置参数、条件逻辑、闭包状态，便于测试复用。

```typescript
import type { BeforeRequestHook } from 'ky'

function createCustomHeaderHook(config: {
  headerName: string
  getValue: () => string | Promise<string>
  condition?: (request: Request) => boolean
}): BeforeRequestHook {
  return async ({ request }) => {
    if (config.condition && !config.condition(request))
      return // 条件性跳过

    const value = await config.getValue()
    if (value)
      request.headers.set(config.headerName, value)
    // 直接修改 headers 即可；如需替换整个请求，也可 `return new Request(...)`（ky 2.0 支持）
  }
}

const http = createClient({
  extendedHooks: {
    beforeRequest: {
      append: [createCustomHeaderHook({
        headerName: 'X-Request-ID',
        getValue: () => crypto.randomUUID(),
        condition: req => req.method !== 'GET',
      })],
    },
  },
})
```

简单场景无需配置时，直接导出：

```typescript
import type { BeforeRequestHook } from 'ky'

export const timestampHook: BeforeRequestHook = async ({ request }) => {
  request.headers.set('X-Timestamp', Date.now().toString())
}

createClient({ extendedHooks: { beforeRequest: { append: [timestampHook] } } })
```

## 实战场景

### 场景 1：请求 ID 追踪

```typescript
function createRequestIdHook(): BeforeRequestHook {
  return async ({ request }) => {
    request.headers.set('X-Request-ID', crypto.randomUUID())
  }
}
```

### 场景 2：条件性日志（afterResponse，注意 clone）

```typescript
import type { AfterResponseHook } from 'ky'

function createDevLoggerHook(enabled: boolean): AfterResponseHook {
  return async ({ request, response }) => {
    if (!enabled)
      return response

    const cloned = response.clone() // 读 body 前必须 clone
    const data = await cloned.json().catch(() => null)
    console.log('[API]', { method: request.method, url: request.url, status: response.status, data })

    return response // afterResponse 必须返回 Response
  }
}

createClient({
  extendedHooks: {
    afterResponse: { append: [createDevLoggerHook(process.env.NODE_ENV === 'development')] },
  },
})
```

### 场景 3：按 URL 动态注入 Header

```typescript
import type { BeforeRequestHook } from 'ky'

function createDynamicHeaderHook(config: {
  rules: Array<{ pattern: RegExp, headers: Record<string, string> }>
}): BeforeRequestHook {
  return async ({ request }) => {
    for (const rule of config.rules) {
      if (rule.pattern.test(request.url)) {
        Object.entries(rule.headers).forEach(([k, v]) => request.headers.set(k, v))
        break
      }
    }
  }
}

createClient({
  extendedHooks: {
    beforeRequest: {
      append: [createDynamicHeaderHook({
        rules: [
          { pattern: /\/api\/v1\//, headers: { 'X-API-Version': 'v1' } },
          { pattern: /\/api\/v2\//, headers: { 'X-API-Version': 'v2' } },
        ],
      })],
    },
  },
})
```

### 场景 4：性能监控（成对 hook + WeakMap 计时）

```typescript
function createPerformanceHook(options: { onSlow?: (duration: number, url: string) => void, threshold?: number }) {
  const startTimes = new WeakMap<Request, number>() // 业务侧计时缓存

  return {
    beforeRequest: async ({ request }) => {
      startTimes.set(request, Date.now())
    },
    afterResponse: async ({ request, response }) => {
      const startTime = startTimes.get(request)
      if (startTime) {
        const duration = Date.now() - startTime
        if (options.threshold && duration > options.threshold)
          options.onSlow?.(duration, request.url)
        startTimes.delete(request)
      }
      return response
    },
  }
}

const perf = createPerformanceHook({ threshold: 1000, onSlow: (d, url) => console.warn(`Slow: ${url} ${d}ms`) })
createClient({
  extendedHooks: {
    beforeRequest: { append: [perf.beforeRequest] },
    afterResponse: { append: [perf.afterResponse] },
  },
})
```

## 编码规范

命名 / 类型标注 / 回调错误处理等约束统一见 [../rules/hook-authoring.md](../rules/hook-authoring.md)。

---

## 相关文档

- [Hook 硬规则](../rules/hook-authoring.md) - 必须遵守的约束
- [设计决策](../references/design-decisions.md) - Hook 系统为何这样设计
- [常见陷阱](../references/gotchas.md) - 错误/正确对照
- [架构设计](../references/architecture.md) - Hook 系统实现细节

[← SKILL.md](../SKILL.md)
