# 约束和限制

[← 返回 CLAUDE.md](../CLAUDE.md)

本文档说明 kk-request 的功能边界、技术限制和性能考虑。

---

## 功能边界

### 不支持的功能

**1. 请求缓存**
- **原因**：@tanstack/query 提供了更强大的缓存能力
- **替代方案**：使用 @tanstack/query 的 `staleTime`、`gcTime`、`invalidation`
- **示例**：
  ```typescript
  useQuery({
    queryKey: ['users'],
    queryFn: () => http.get('/users'),
    staleTime: 60000, // 缓存 1 分钟
  })
  ```

**2. 通用自动重试**
- **原因**：ky 已内置重试，@tanstack/query 提供了更灵活的重试策略
- **说明**：针对网络错误 / 5xx 的通用重试交给 ky 的 `retry` 选项；
  而 **401 access token 刷新重试是本库内置能力**（见 unauthorized hook，基于 `ky.retry()`）
- **示例**：
  ```typescript
  // 通用重试：直接用 ky 的 retry 选项
  createClient({ retry: 3 })

  // 或交给 @tanstack/query
  useQuery({ queryKey: ['users'], queryFn: () => http.get('/users'), retry: 3 })
  ```

**3. 请求去重**
- **原因**：@tanstack/query 自动合并相同的并发请求
- **替代方案**：使用 @tanstack/query
- **示例**：
  ```typescript
  // 多个组件同时调用，只发送一次请求
  useQuery({ queryKey: ['users'], queryFn: () => http.get('/users') })
  ```

**4. 进度监听**
- **原因**：需要访问底层 Fetch API
- **替代方案**：使用 `raw` getter 访问 ky 实例
- **示例**：
  ```typescript
  const response = await http.raw.get('download')
  const reader = response.body?.getReader()
  // 手动处理流
  ```

---

## 技术限制

### 限制 1：不支持中途取消 Hook 执行

**问题**：Hook 一旦开始执行，无法在 Hook 内部中途取消整条链

**解决方案**：
1. 在 Hook 中使用条件逻辑跳过执行
2. 使用 `AbortController` 取消整个请求

**示例**：

```typescript
// 方案 1：条件逻辑
const myHook = async ({ request }) => {
  if (shouldSkip(request)) {
    return // 跳过执行
  }
  // Hook 逻辑...
}

// 方案 2：取消整个请求（取消会抛出 name 为 'AbortError' 的错误，原样传播）
const controller = Request.createAbortController()
http.get('api', { signal: controller.signal })
controller.abort()
```

### 限制 2：401 刷新重试依赖 `getToken` 读取到最新 token

**说明**：刷新成功后，重试请求会显式写入新 token（`Authorization` 头）。
若业务还依赖 `auth.getToken()` 在后续请求中返回新 token，请确保在 `onRefreshSuccess` 中已将新 token 持久化。

```typescript
createClient({
  auth: {
    getToken: () => store.accessToken,
    refreshToken: {
      getRefreshToken: () => store.refreshToken,
      refresh: rt => api.refresh(rt),
      onRefreshSuccess: (newToken) => {
        store.accessToken = newToken // 持久化，后续请求才能拿到新 token
      },
    },
  },
})
```

---

## 依赖要求

### 运行时依赖（dependencies）

ky / qs / parse-sse 已作为**直接依赖**随包安装（不再是 peerDependencies），以保证版本一致、消费方无需手动安装：

- **ky**: ^2.0.2（HTTP 客户端，本库硬依赖其 2.0 API：`ky.retry()` / `prefix` / state 对象 hook）
- **qs**: ^6.x（查询字符串序列化，内部使用）
- **parse-sse**: ^0.1.0（SSE 解析，内部使用）

> 因本库重导出了 ky 的错误类型，消费方做 `instanceof HTTPError` 时请从 `@kkfive/request` 导入，避免与自身的 `ky` 副本不一致。

### 运行时要求

- **Node.js**: >= 22（ky 2.0 要求）
- **TypeScript**: >= 5.0（如果使用 TypeScript）
- **浏览器**：支持 Fetch API

### 兼容性

**支持的环境**：
- ✅ 现代浏览器（Chrome、Firefox、Safari、Edge）
- ✅ Node.js 22+
- ✅ Deno
- ✅ Cloudflare Workers

**不支持的环境**：
- ❌ IE 11（不支持 Fetch API）
- ❌ Node.js < 22

---

## 性能考虑

### Hook 执行开销

**问题**：每个请求都会执行所有启用的 hooks

**优化建议**：
1. 禁用不需要的内置 hooks（`features.enableXxx = false`）
2. 在 Hook 中使用条件逻辑跳过不必要的执行
3. 避免在 Hook 中执行耗时操作

**示例**：

```typescript
// 禁用不需要的 hooks
createClient({
  features: {
    enableContentType: false,
    enableParamsSerializer: false,
  },
})

// 条件性执行
const myHook = async ({ request }) => {
  if (request.method === 'GET') {
    return // GET 请求跳过
  }
  // 只对 POST/PUT 执行...
}
```

---

## 相关文档

- [设计决策](./design-decisions.md) - 了解这些限制背后的设计权衡
- [常见陷阱](./pitfalls.md) - 避免触发这些限制
- [Hook 开发指南](./hook-development.md) - 学习如何在限制内开发
- [架构设计](./architecture.md) - 了解技术实现

[← 返回 CLAUDE.md](../CLAUDE.md)
