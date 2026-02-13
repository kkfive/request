# 常见陷阱

[← 返回 CLAUDE.md](../CLAUDE.md)

本文档列出了开发中最容易遇到的 5 个陷阱，每个陷阱都提供了错误示例、正确示例和详细解释。

---

## 陷阱 1：在 beforeRequest hook 中返回新的 Request

### 错误示例

```typescript
// ❌ 错误：会破坏 WeakMap 缓存，导致 401 retry 失败
const myHook: BeforeRequestHook = async (request) => {
  const newHeaders = new Headers(request.headers)
  newHeaders.set('X-Custom', 'value')
  return new Request(request, { headers: newHeaders })
}
```

### 正确示例

```typescript
// ✅ 正确：直接修改 headers
const myHook: BeforeRequestHook = async (request) => {
  request.headers.set('X-Custom', 'value')
}
```

### 原因

`src/hooks/builtin/auth.ts` 使用 WeakMap 缓存原始 Request 对象：

```typescript
const requestBodyCache = new WeakMap<globalThis.Request, globalThis.Request>()

// 缓存原始 Request
requestBodyCache.set(request, clonedRequest)
```

如果返回新的 Request 实例，WeakMap 的键会变化，导致：
- 401 retry 时找不到缓存的 body
- POST/PUT 请求 retry 失败

**详见**：[设计决策 - WeakMap 缓存](./design-decisions.md#决策-2为什么使用-weakmap-缓存请求-body)

### 何时可以返回新 Request？

只有在 `extendedHooks.beforeRequest.prepend` 中（auth hook 之前）才可以：

```typescript
createClient({
  extendedHooks: {
    beforeRequest: {
      prepend: [
        // ✅ 在 auth hook 之前，可以返回新 Request
        async (request) => {
          return new Request(request, { headers: newHeaders })
        },
      ],
    },
  },
})
```

---

## 陷阱 2：忘记 clone Response 就读取 body

### 错误示例

```typescript
// ❌ 错误：body 只能读取一次
const myHook: AfterResponseHook = async (request, options, response) => {
  const data = await response.json()
  console.log(data)
  return response // body 已被消费，后续无法读取
}
```

### 正确示例

```typescript
// ✅ 正确：先 clone
const myHook: AfterResponseHook = async (request, options, response) => {
  const cloned = response.clone()
  const data = await cloned.json()
  console.log(data)
  return response // 原始 response 的 body 未被消费
}
```

### 原因

Response body 是一个流（Stream），只能读取一次。读取后：
- `response.bodyUsed` 变为 `true`
- 后续无法再次读取 body
- 其他 hooks 或用户代码会失败

### 何时需要 clone？

只要需要读取 body，就必须 clone：

```typescript
// 需要 clone 的场景
await response.json()
await response.text()
await response.blob()
await response.arrayBuffer()
await response.formData()
```

---

## 陷阱 3：在 refresh token 回调中抛出异常

### 错误示例

```typescript
// ⚠️ 注意：回调异常已被隔离（v0.1.1），不会影响 refresh 状态
// 但仍然建议避免在回调中抛出异常
createClient({
  auth: {
    refreshToken: {
      onRefreshSuccess: (token) => {
        // ❌ 如果 localStorage 不可用，会抛出异常
        localStorage.setItem('token', token)
      },
    },
  },
})
```

### 正确示例

```typescript
// ✅ 正确：捕获回调中的异常
createClient({
  auth: {
    refreshToken: {
      onRefreshSuccess: (token) => {
        try {
          localStorage.setItem('token', token)
        } catch (error) {
          console.error('Failed to save token:', error)
        }
      },
    },
  },
})
```

### 原因

虽然回调异常已被隔离（`src/hooks/builtin/unauthorized.ts` 中的 `onRefreshSuccess` 回调处理），但：
- 异常会被记录到控制台
- 可能影响用户体验
- 最佳实践是在回调中处理异常

### 实现位置

`src/hooks/builtin/unauthorized.ts`（查看 `createUnauthorizedHook` 函数中的回调异常处理）

```typescript
// 回调异常隔离逻辑
if (isRefreshInitiator) {
  try {
    await auth.refreshToken.onRefreshSuccess?.(newToken)
  } catch (callbackError) {
    // 回调异常不影响 refresh 成功状态，仅记录错误
    console.error('[kk-request] onRefreshSuccess callback error:', callbackError)
  }
}
```

---

## 陷阱 4：在 Hook 中使用 async/await 但不返回 Promise

### 错误示例

```typescript
// ❌ 错误：async 函数必须返回值
const myHook: AfterResponseHook = async (request, options, response) => {
  const cloned = response.clone()
  const data = await cloned.json()
  console.log(data)
  // ❌ 忘记返回 response
}
```

### 正确示例

```typescript
// ✅ 正确：必须返回 Response
const myHook: AfterResponseHook = async (request, options, response) => {
  const cloned = response.clone()
  const data = await cloned.json()
  console.log(data)
  return response // ✅ 返回原始 response
}
```

### 原因

afterResponse hook 必须返回 Response 对象：
- 返回值会传递给下一个 hook
- 最终返回给用户
- 不返回会导致 `undefined`

---

## 陷阱 5：在 Hook 中修改 options 对象

### 错误示例

```typescript
// ❌ 错误：修改 options 可能影响其他 hooks
const myHook: BeforeRequestHook = async (request, options: any) => {
  options.timeout = 5000 // ❌ 修改共享对象
}
```

### 正确示例

```typescript
// ✅ 正确：只读取 options，不修改
const myHook: BeforeRequestHook = async (request, options: any) => {
  const timeout = options.timeout || 10000
  // 使用 timeout，但不修改 options
}
```

### 原因

`options` 对象在所有 hooks 之间共享：
- 修改会影响后续 hooks
- 可能导致不可预测的行为
- 违反单一职责原则

---

## 快速检查清单

在编写 Hook 时，检查以下几点：

- [ ] beforeRequest hook 是否直接修改 request，而不是返回新 Request？
- [ ] afterResponse hook 读取 body 前是否先 clone？
- [ ] afterResponse hook 是否返回 Response 对象？
- [ ] 回调函数中是否捕获了异常？
- [ ] 是否避免修改 options 对象？

---

## 相关文档

- [设计决策](./design-decisions.md) - 了解这些陷阱背后的设计原理
- [Hook 开发指南](./hook-development.md) - 学习正确的 Hook 开发模式
- [约束和限制](./constraints.md) - 了解更多技术限制
- [架构设计](./architecture.md) - 了解 Hook 系统的实现

[← 返回 CLAUDE.md](../CLAUDE.md)
