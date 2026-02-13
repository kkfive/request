# 约束和限制

[← 返回 CLAUDE.md](../CLAUDE.md)

本文档说明 kk-request 的功能边界、技术限制和性能考虑。

---

## 功能边界

### 不支持的功能

**1. 请求缓存**
- **原因**：@tanstack/query 提供了更强大的缓存能力
- **替代方案**：使用 @tanstack/query 的 `staleTime`、`cacheTime`、`invalidation`
- **示例**：
  ```typescript
  useQuery({
    queryKey: ['users'],
    queryFn: () => http.get('/users'),
    staleTime: 60000, // 缓存 1 分钟
  })
  ```

**2. 自动重试**
- **原因**：ky 已支持重试，@tanstack/query 提供了更灵活的重试策略
- **替代方案**：
  - ky 的 `retry` 选项
  - @tanstack/query 的 `retry` 配置
- **示例**：
  ```typescript
  // 使用 ky 的 retry
  createClient({ retry: 3 })

  // 使用 @tanstack/query 的 retry
  useQuery({
    queryKey: ['users'],
    queryFn: () => http.get('/users'),
    retry: 3,
  })
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
  const response = await http.raw.get('/download')
  const reader = response.body?.getReader()
  // 手动处理流
  ```

---

## 技术限制

### 限制 1：WeakMap 缓存的局限性

**问题**：如果在 `extendedHooks.beforeRequest.append` 中返回新的 Request 实例，会破坏缓存

**影响**：401 retry 时 POST/PUT 请求会失败

**原因**：
- `src/hooks/builtin/auth.ts` 使用 WeakMap 缓存原始 Request 对象
- 返回新 Request 会改变 WeakMap 的键
- 401 retry 时找不到缓存的 body

**解决方案**：
1. 只修改 headers，不要替换整个 Request 对象
2. 如果必须替换，在 `prepend` 中执行（auth hook 之前）

**示例**：

```typescript
// ❌ 错误：在 append 中返回新 Request
createClient({
  extendedHooks: {
    beforeRequest: {
      append: [
        async (request) => {
          return new Request(request, { headers: newHeaders })
        },
      ],
    },
  },
})

// ✅ 正确：直接修改 headers
createClient({
  extendedHooks: {
    beforeRequest: {
      append: [
        async (request) => {
          request.headers.set('X-Custom', 'value')
        },
      ],
    },
  },
})

// ✅ 正确：在 prepend 中返回新 Request（auth hook 之前）
createClient({
  extendedHooks: {
    beforeRequest: {
      prepend: [
        async (request) => {
          return new Request(request, { headers: newHeaders })
        },
      ],
    },
  },
})
```

**代码位置**：`src/hooks/builtin/auth.ts`（查看 `requestBodyCache` 和 `createAuthHook` 函数）

**详见**：[设计决策 - WeakMap 缓存](./design-decisions.md#决策-2为什么使用-weakmap-缓存请求-body)、[常见陷阱 - 陷阱 1](./pitfalls.md#陷阱-1在-beforerequest-hook-中返回新的-request)

---

### 限制 2：FormData 不支持 401 retry

**问题**：FormData body 无法克隆（避免大文件内存压力）

**影响**：FormData 上传遇到 401 不会自动 retry

**原因**：
- 大文件上传克隆会占用大量内存
- 为了性能，跳过 FormData 的 body 克隆
- 401 retry 时无法重新发送 body

**解决方案**：在业务层处理 FormData 上传的 401 错误

**示例**：

```typescript
// FormData 上传需要手动处理 401
async function uploadFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  try {
    await http.post('/upload', formData)
  } catch (error) {
    if (error.response?.status === 401) {
      // 手动刷新 token 并重试
      await refreshToken()
      await http.post('/upload', formData)
    }
  }
}
```

**代码位置**：`src/hooks/builtin/auth.ts`（查看 FormData 跳过克隆的逻辑）

**详见**：[常见陷阱 - 陷阱 2](./pitfalls.md#陷阱-2忘记-clone-response-就读取-body)

---

### 限制 3：不支持同步 Hook

**问题**：所有 Hook 必须是 async 函数

**影响**：无法使用同步逻辑

**原因**：
- ky 的 hooks API 要求 async 函数
- 统一异步处理，避免混乱

**解决方案**：将同步逻辑包装在 async 函数中

**示例**：

```typescript
// ❌ 错误：同步 Hook
const myHook = (request) => {
  request.headers.set('X-Custom', 'value')
}

// ✅ 正确：async Hook
const myHook = async (request) => {
  request.headers.set('X-Custom', 'value')
}
```

---

### 限制 4：不支持取消 Hook 执行

**问题**：Hook 一旦开始执行，无法中途取消

**影响**：无法在 Hook 中提前终止请求

**原因**：
- ky 的 hooks API 不支持取消
- Hook 必须执行完成

**解决方案**：
1. 在 Hook 中使用条件逻辑跳过执行
2. 使用 `AbortController` 取消整个请求

**示例**：

```typescript
// 方案 1：条件逻辑
const myHook = async (request) => {
  if (shouldSkip(request)) {
    return // 跳过执行
  }
  // Hook 逻辑...
}

// 方案 2：取消整个请求
const controller = Request.createAbortController()
http.get('/api', { signal: controller.signal })
controller.abort() // 取消请求
```

---

## 依赖要求

### Peer Dependencies

- **ky**: ^1.0.0（HTTP 客户端）
- **qs**: ^6.0.0（查询字符串解析）

### 运行时要求

- **Node.js**: >= 18
- **TypeScript**: >= 5.0（如果使用 TypeScript）
- **浏览器**：支持 Fetch API 和 WeakMap

### 兼容性

**支持的环境**：
- ✅ 现代浏览器（Chrome、Firefox、Safari、Edge）
- ✅ Node.js 18+
- ✅ Deno
- ✅ Cloudflare Workers

**不支持的环境**：
- ❌ IE 11（不支持 Fetch API）
- ❌ Node.js < 18（不支持 Fetch API）

---

## 性能考虑

### Hook 执行开销

**问题**：每个请求都会执行所有 hooks

**影响**：
- 5 个内置 hooks + 用户自定义 hooks
- 每个 hook 都有执行开销

**优化建议**：
1. 禁用不需要的内置 hooks
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
const myHook = async (request) => {
  if (request.method === 'GET') {
    return // GET 请求跳过
  }
  // 只对 POST/PUT 执行...
}
```

### WeakMap 内存占用

**问题**：WeakMap 缓存会占用内存

**影响**：
- 每个 POST/PUT 请求都会克隆 body
- 大量并发请求会占用内存

**优化**：
- FormData 自动跳过克隆
- Request 对象被 GC 时自动清理缓存
- 401 retry 后立即清理缓存

**代码位置**：`src/hooks/builtin/auth.ts`（查看 `requestBodyCache` 和 `createAuthHook` 函数）

---

## 相关文档

- [设计决策](./design-decisions.md) - 了解这些限制背后的设计权衡
- [常见陷阱](./pitfalls.md) - 避免触发这些限制
- [Hook 开发指南](./hook-development.md) - 学习如何在限制内开发
- [架构设计](./architecture.md) - 了解技术实现

[← 返回 CLAUDE.md](../CLAUDE.md)
