# 设计决策

[← SKILL.md](../SKILL.md)

本文档记录 kk-request 的关键设计决策及其**理由（why）**。硬性「必须怎么做」的约束见 [../rules/hook-authoring.md](../rules/hook-authoring.md) 与 [../rules/error-model.md](../rules/error-model.md)。

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
- `src/hooks/*.ts` - 内置 hooks 实现

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

> ⚠️ ky 2.0 的 hook 采用 **state 对象**签名 `({ request, options, response, retryCount }) => ...`，
> 不再是 1.x 的位置参数。编写自定义 hook 的硬约束见 [../rules/hook-authoring.md](../rules/hook-authoring.md)。

---

## 决策 2：401 刷新重试为什么交给 ky 原生 `ky.retry()`？

### 问题
access token 过期（401）时，如何用刷新后的新 token 自动重发原请求？

### 方案
在 `afterResponse` hook 中刷新 token，然后返回 **`ky.retry({ request })`**，由 ky 完成重发。

### 理由
- **复用 ky 的重试机制**：ky 内部负责重发、重试计数与请求 body 处理，无需自己造轮子
- **强制重试跳过 method 检查**：`ky.retry()` 产生的 `ForceRetryError` 会跳过默认的 method 白名单，因此 **POST / PUT / FormData 同样能重试**
- **用 `retryCount` 防无限循环**：`retryCount > 0` 即说明是重试请求，直接放行，无需额外的标记 header 或标记 hook
- **不污染 HTTP headers**：完全在前端完成，不触发 CORS 预检

### 实现位置
`src/hooks/unauthorized.ts`（查看 `ky.retry({ request })` 与 `retryCount` 判定）

### 代码示例

```typescript
return async ({ request, response, retryCount }) => {
  if (response.status !== 401)
    return response

  // 已重试过仍 401 → 放弃，交给 ky 抛出 HTTPError(401)
  if (retryCount > 0) {
    onUnauthorized?.()
    return response
  }

  if (auth?.refreshToken) {
    const newToken = await dedupedRefresh() // 见决策 3
    // 显式写入新 token（重试不会再执行 beforeRequest 的 auth hook）
    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${newToken}`)
    return ky.retry({ request: new Request(request, { headers }), code: 'TOKEN_REFRESHED' })
  }

  onUnauthorized?.()
  return response // 无 refreshToken → 交给 ky 抛出 HTTPError(401)
}
```

### 历史说明
早期版本曾用 **WeakMap 缓存 clone 的请求 body** + **`__kkRetry` 标记 hook** + 手动调用 `kyInstance(newRequest)` 来实现重试。
迁移到 ky 2.0 后改用 `ky.retry()`，上述机制全部移除，同时消除了「FormData 无法 retry」「返回新 Request 破坏缓存」两条历史限制。

---

## 决策 3：为什么 refresh token 使用闭包级 Promise？

### 问题
并发请求同时遇到 401 时，会重复刷新 token。ky 原生的重试**不会**对并发刷新做去重。

### 方案
在 hook 工厂内用闭包级 `refreshPromise` 实现去重，叠加在 `ky.retry()` 之上。

### 理由
- **去重**：多个并发 401 只触发一次 `refresh()`
- **等待**：后到的请求等待同一个刷新 Promise 完成
- **各自重试**：刷新完成后，每个请求各自用新 token 通过 `ky.retry()` 重发

### 实现位置
`src/hooks/unauthorized.ts`（查看 `createUnauthorizedHook` 中的 `refreshPromise` 闭包变量）

### 效果
```
请求 A 遇到 401 → 创建 refreshPromise → 开始刷新
请求 B 遇到 401 → 发现 refreshPromise 存在 → 等待
请求 C 遇到 401 → 发现 refreshPromise 存在 → 等待
  ↓
刷新完成 → A/B/C 各自用新 token 通过 ky.retry() 重发
```

---

## 决策 4：错误体系为什么区分 `BusinessError` 与 ky 原生错误？

### 问题
请求失败有两类性质完全不同的原因：**传输层失败**（非 2xx、网络、超时）与**业务层失败**（HTTP 2xx，但响应体业务字段 `code` 不等于 `successCode`）。如何让上层拿到完整、可区分的错误信息？

### 方案
- **传输层错误**：原样透传 ky 的原生错误类型，不做任何包装或归一
  （`HTTPError` / `NetworkError` / `TimeoutError` / `ForceRetryError` / `KyError`，均从本包重新导出）
- **业务层错误**：抛出 kk-request 独有的 **`BusinessError`**（携带业务 `code`、原始 `raw`、`response`）

### 理由
- **信息完整**：ky 的 `HTTPError` 自带 `response`、预解析的 `data`、`request`、`options`，包装成通用错误反而丢信息
- **职责清晰**：传输层是 ky 的领域，业务层是 kk-request 的领域；`instanceof BusinessError` 即业务错误判定
- **可用官方守卫**：消费方可直接用 `isHTTPError` / `isTimeoutError` 等 ky 类型守卫

> 消费方应如何区分处理这两类错误，见 [../rules/error-model.md](../rules/error-model.md)。

### 实现位置
- `src/errors/business-error.ts` - `BusinessError` 类（`errors/` 为目录，便于后续新增其它错误类型）
- `src/client/request.ts` - catch 块原样抛出，仅触发生命周期回调
- `src/hooks/response-parser.ts` - 仅在业务 code 不符时抛出 `BusinessError`

---

## 相关文档

- [架构设计](./architecture.md) - 了解整体架构
- [Hook 开发指南](../workflows/add-custom-hook.md) - 学习如何应用这些设计
- [常见陷阱](./gotchas.md) - 避免违反设计约束
- [约束和限制](../rules/boundaries.md) - 了解设计带来的限制

[← SKILL.md](../SKILL.md)
