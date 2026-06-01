# 设计决策

[← 返回 CLAUDE.md](../CLAUDE.md)

本文档记录了 kk-request 的 4 个关键设计决策及其理由。

---

## 决策 1：为什么使用 Hook 系统？

### 问题
如何让用户灵活地扩展和定制请求/响应处理逻辑？

### 方案
基于 ky 的 hooks API 实现可插拔的 Hook 系统

### 理由
- **可插拔**：用户可以禁用任何内置 hook
- **可扩展**：用户可以添加自定义 hook
- **可替换**：用户可以替换内置 hook 的实现
- **职责分离**：每个 hook 只负责一件事

### 实现位置
- `src/hooks/registry.ts` - Hook 注册和解析
- `src/hooks/builtin/` - 内置 hooks 实现

### 示例

```typescript
// 禁用内置 hook
createClient({
  features: { enableContentType: false }
})

// 替换内置 hook
createClient({
  extendedHooks: {
    control: { replace: { auth: myCustomAuthHook } }
  }
})

// 扩展自定义 hook
createClient({
  extendedHooks: {
    beforeRequest: { append: [myCustomHook] }
  }
})
```

---

## 决策 2：为什么使用 WeakMap 缓存请求 body？

### 问题
401 retry 时，Request body 已被消费，无法重新发送

### 方案
在 auth hook 中克隆 body 并使用 WeakMap 缓存

### 理由
- **支持 retry**：缓存的 body 可以在 401 时重新使用
- **自动清理**：WeakMap 在 Request 对象被 GC 时自动清理缓存
- **内存优化**：FormData 跳过克隆，避免大文件内存压力

### 实现位置
`src/hooks/builtin/auth.ts`（查看 `requestBodyCache` 声明和使用）

### 代码示例

```typescript
// 用于缓存请求 body 的 WeakMap
const requestBodyCache = new WeakMap<globalThis.Request, globalThis.Request>()

// 在 auth hook 中克隆并缓存
if (auth?.refreshToken && request.method !== 'GET' && request.body) {
  const isFormData = options?.body instanceof FormData
  if (!isFormData) {
    try {
      const clonedRequest = request.clone()
      requestBodyCache.set(request, clonedRequest)
    } catch (error) {
      console.warn('[kk-request] Failed to clone request body for retry:', error)
    }
  }
}
```

### 限制
- **FormData 不支持 retry**：大文件上传跳过克隆
- **新 Request 破坏缓存**：在 `extendedHooks.beforeRequest.append` 中返回新 Request 会导致缓存失效

详见：`docs/constraints.md`

---

## 决策 3：为什么 refresh token 使用闭包级 Promise？

### 问题
并发请求同时遇到 401 时，会重复刷新 token

### 方案
使用闭包级 `refreshPromise` 实现去重

### 理由
- **去重**：多个 401 只触发一次刷新
- **等待**：其他请求等待刷新完成
- **自动重试**：刷新成功后所有请求自动重试

### 实现位置
`src/hooks/builtin/unauthorized.ts`（查看 `createUnauthorizedHook` 函数中的 `refreshPromise` 闭包变量）

### 代码示例

```typescript
function createUnauthorizedHook(...): AfterResponseHook {
  // 闭包级 Promise，每个 hook 实例独立
  let refreshPromise: Promise<string> | null = null

  return async (request, options, response) => {
    if (response.status === 401) {
      // 标记是否为本次刷新的发起者（函数内部声明，每个请求独立）
      let shouldTriggerCallback = false
      // 如果已有刷新请求，等待它完成；否则立即创建 Promise 占位
      if (!refreshPromise) {
        shouldTriggerCallback = true
        refreshPromise = (async () => {
          const refreshToken = await auth.refreshToken.getRefreshToken()
          return await auth.refreshToken.refresh(refreshToken)
        })()
      }
      const newToken = await refreshPromise
      refreshPromise = null

      // 重试请求...
    }
  }
}
```

### 效果
```
请求 A 遇到 401 → 创建 refreshPromise → 开始刷新
请求 B 遇到 401 → 发现 refreshPromise 存在 → 等待
请求 C 遇到 401 → 发现 refreshPromise 存在 → 等待
  ↓
刷新完成 → 请求 A/B/C 都使用新 token 重试
```

---

## 决策 4：为什么使用 Hook 标记而不是 Header 标记？

### 问题
如何标识 retry 请求，避免无限重试？

### 方案
在 hook 函数上添加 `__kkRetry` 标记

### 理由
- **避免 CORS 预检**：自定义 header 会触发 OPTIONS 请求
- **减少 RTT**：避免额外的网络往返
- **纯前端**：不污染 HTTP headers

### 实现位置
`src/hooks/builtin/unauthorized.ts`（查看 `retryMarkerHook` 和 `__kkRetry` 标记）

### 代码示例

```typescript
// 创建标记 hook
const retryMarkerHook = async () => {
  // No-op hook，仅用于标记
}
;(retryMarkerHook as any).__kkRetry = true

// 检查是否为 retry 请求
const isRetryRequest = options.hooks?.beforeRequest?.some(
  (hook: any) => hook.__kkRetry === true
)

if (isRetryRequest) {
  // 这是 retry 请求，不再重试
  return response
}
```

### 对比

**使用 Header 标记**（❌ 不推荐）：
```typescript
// 会触发 CORS 预检
request.headers.set('X-Retry', 'true')
```

**使用 Hook 标记**（✅ 推荐）：
```typescript
// 纯前端，不触发 CORS 预检
;(retryMarkerHook as any).__kkRetry = true
```

### 优势
- 完全纯前端，避免 CORS 预检
- 减少 1 RTT（往返时间）
- 不污染 HTTP headers

---

## 相关文档

- [架构设计](./architecture.md) - 了解整体架构
- [Hook 开发指南](./hook-development.md) - 学习如何应用这些设计
- [常见陷阱](./pitfalls.md) - 避免违反设计约束
- [约束和限制](./constraints.md) - 了解设计带来的限制

[← 返回 CLAUDE.md](../CLAUDE.md)
