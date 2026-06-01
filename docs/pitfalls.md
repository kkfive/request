# 常见陷阱

[← 返回 CLAUDE.md](../CLAUDE.md)

本文档列出开发中最容易遇到的陷阱，每个都提供错误示例、正确示例和详细解释。

---

## 陷阱 1：使用 ky 1.x 的位置参数 hook 签名

### 错误示例

```typescript
// ❌ 错误：ky 1.x 的位置参数签名，在 ky 2.0 下 request/options/response 全部错位
const myHook: BeforeRequestHook = async (request, options) => {
  request.headers.set('X-Custom', 'value') // request 实际是整个 state 对象
}
```

### 正确示例

```typescript
// ✅ 正确：ky 2.0 使用 state 对象签名，按需解构
const myHook: BeforeRequestHook = async ({ request, options }) => {
  request.headers.set('X-Custom', 'value')
}
```

### 原因

ky 2.0 统一将所有 hook 改为单个 **state 对象**参数：

- `beforeRequest`：`({ request, options, retryCount })`
- `afterResponse`：`({ request, options, response, retryCount })`
- `beforeRetry` / `beforeError`：`({ request, options, error, retryCount })`

仍按位置参数 `(request, options, response)` 编写时，第一个参数拿到的是整个 state 对象，`options`/`response` 为 `undefined`，行为完全错误。

> ky 2.0 起，beforeRequest 返回新的 `Request` 是被支持的（旧版本因 WeakMap 缓存而禁止，现已移除该限制）。

---

## 陷阱 2：忘记 clone Response 就读取 body

### 错误示例

```typescript
// ❌ 错误：body 只能读取一次
const myHook: AfterResponseHook = async ({ response }) => {
  const data = await response.json()
  console.log(data)
  return response // body 已被消费，后续无法读取
}
```

### 正确示例

```typescript
// ✅ 正确：先 clone
const myHook: AfterResponseHook = async ({ response }) => {
  const cloned = response.clone()
  const data = await cloned.json()
  console.log(data)
  return response // 原始 response 的 body 未被消费
}
```

### 原因

Response body 是一个流（Stream），只能读取一次。读取后 `response.bodyUsed` 变为 `true`，后续 hooks 或用户代码再读取会失败。

只要需要读取 body（`json()` / `text()` / `blob()` / `arrayBuffer()` / `formData()`），就必须先 `clone()`。

---

## 陷阱 3：在 refresh token 回调中抛出异常

### 错误示例

```typescript
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
createClient({
  auth: {
    refreshToken: {
      onRefreshSuccess: (token) => {
        try {
          localStorage.setItem('token', token)
        }
        catch (error) {
          console.error('Failed to save token:', error)
        }
      },
    },
  },
})
```

### 原因

`onRefreshSuccess` / `onRefreshFail` / `onUnauthorized` 等回调的异常已被库内部隔离（不会影响刷新/重试状态），但仍会被打印到控制台。最佳实践是在回调内部自行处理异常。

### 实现位置

`src/hooks/unauthorized.ts`（查看 `safeInvoke` / `safeInvokeAsync` 包装）

```typescript
if (isInitiator) {
  await safeInvokeAsync(
    () => auth.refreshToken!.onRefreshSuccess?.(newToken),
    'onRefreshSuccess',
  )
}
```

---

## 陷阱 4：afterResponse hook 忘记返回 Response

### 错误示例

```typescript
// ❌ 错误：忘记返回，返回值变成 undefined
const myHook: AfterResponseHook = async ({ response }) => {
  const data = await response.clone().json()
  console.log(data)
  // ❌ 忘记 return
}
```

### 正确示例

```typescript
// ✅ 正确：返回 Response（或 ky.retry() 触发重试）
const myHook: AfterResponseHook = async ({ response }) => {
  const data = await response.clone().json()
  console.log(data)
  return response
}
```

### 原因

afterResponse hook 的返回值会传递给下一个 hook，最终决定 ky 使用的响应。返回 `Response` 覆盖响应；返回 `ky.retry(...)` 触发强制重试；返回 `undefined`（忘记 return）则可能丢失响应。

---

## 陷阱 5：在 Hook 中修改 options 对象

### 错误示例

```typescript
// ❌ 错误：ky 2.0 传入 hook 的 options 是被 Object.freeze 冻结的，赋值会抛错或静默失败
const myHook: BeforeRequestHook = async ({ options }) => {
  ;(options as any).timeout = 5000
}
```

### 正确示例

```typescript
// ✅ 正确：只读取 options，不修改
const myHook: BeforeRequestHook = async ({ request, options }) => {
  const timeout = (options as any).timeout || 10000
  // 如需改变行为，修改 request 或在请求级配置中传入，而非改 options
}
```

### 原因

ky 2.0 传给 hook 的 `options` 是 `Object.freeze` 后的归一化选项，在所有 hooks 间共享，不应（也无法）被修改。需要传递自定义数据时，使用 ky 的 `context` 选项。

---

## 快速检查清单

在编写 Hook 时，检查以下几点：

- [ ] 是否使用 ky 2.0 的 **state 对象签名**（而非位置参数）？
- [ ] afterResponse hook 读取 body 前是否先 `clone()`？
- [ ] afterResponse hook 是否返回 Response（或 `ky.retry()`）？
- [ ] refreshToken 回调中是否捕获了异常？
- [ ] 是否避免修改（已冻结的）options 对象？

---

## 相关文档

- [设计决策](./design-decisions.md) - 了解这些陷阱背后的设计原理
- [Hook 开发指南](./hook-development.md) - 学习正确的 Hook 开发模式
- [约束和限制](./constraints.md) - 了解更多技术限制
- [架构设计](./architecture.md) - 了解 Hook 系统的实现

[← 返回 CLAUDE.md](../CLAUDE.md)
