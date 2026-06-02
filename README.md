# @kkfive/request

基于 [ky](https://github.com/sindresorhus/ky) 的轻量级 HTTP 客户端封装层，专注于业务层请求封装。

## 项目定位

**kk-request 是一个封装层，不是完整的 HTTP 客户端**。它专注于提供业务层的请求封装能力：

- ✅ Token 注入（支持 refresh token 自动刷新，基于 `ky.retry()`）
- ✅ 响应解析（raw / body / data 三种模式）
- ✅ 业务错误（`BusinessError`）与 ky 原生传输错误区分
- ✅ 生命周期回调
- ✅ SSE 流式请求（基于 [parse-sse](https://github.com/sindresorhus/parse-sse)）

**高级功能交由专业工具处理**：

- 缓存、重试、去重 → [@tanstack/query](https://tanstack.com/query)
- HTTP 请求、超时、取消 → [ky](https://github.com/sindresorhus/ky)

## 两种使用方式

### 1. 简单项目直接使用

适合不需要复杂功能的项目，通过简单配置即可开箱即用：

```typescript
const http = createClient({
  prefix: 'https://api.example.com',
  auth: { getToken: () => localStorage.getItem('token') },
  responseParser: { responseReturn: 'data' },
})

const users = await http.get<User[]>('/users')
```

### 2. 复杂项目配合上层框架

与 @tanstack/query 配合使用，职责分工清晰：

```typescript
// kk-request 处理业务层封装
const http = createClient({ /* ... */ })

// @tanstack/query 处理缓存、重试等
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: () => http.get<User[]>('/users'),
  retry: 3,           // 由 @tanstack/query 处理重试
  staleTime: 60000,   // 由 @tanstack/query 处理缓存
})
```

## 设计理念

1. **专注封装层职责** - 只做业务层封装，不越界
2. **充分利用 ky** - ky 已有的功能无需重复实现
3. **与上层框架配合** - 高级功能交由 @tanstack/query 等框架处理
4. **二次封装友好** - 提供灵活的 Hooks 系统

## 为什么不实现缓存、重试等功能？

- **缓存** - @tanstack/query 提供了更强大的缓存能力（staleTime、cacheTime、invalidation）
- **重试** - ky 已支持重试，@tanstack/query 提供了更灵活的重试策略
- **去重** - @tanstack/query 自动合并相同的并发请求
- **状态管理** - @tanstack/query 提供了完整的请求状态管理

这些功能由专业工具处理，效果更好，也避免了功能重复和职责混乱。

## 安装

```bash
pnpm add @kkfive/request
```

> ky / qs / parse-sse 已作为直接依赖随包安装，无需手动安装。

## 快速开始

```typescript
import { createClient } from '@kkfive/request'

const http = createClient({
  prefix: 'https://api.example.com',
  responseParser: {
    responseReturn: 'data',
    codeField: 'code',
    dataField: 'data',
    successCode: 0,
  },
})

// GET 请求
const users = await http.get<User[]>('/users')

// POST 请求
const user = await http.post<User>('/users', { name: 'test' })
```

> 💡 完整的可运行示例（含 token 刷新、错误处理、SSE）见 [`examples/index.ts`](./examples/index.ts)。

## 功能特性

### Token 注入

支持异步获取 token，自定义 header 名称和前缀方案。

```typescript
const http = createClient({
  prefix: 'https://api.example.com',
  auth: {
    getToken: async () => localStorage.getItem('token'),
    headerName: 'token', // 默认 'Authorization'
    scheme: null, // 默认 'Bearer'，null 表示不加前缀
  },
  // 额外 headers
  getHeaders: () => ({ terminal: 'web' }),
})
```

### Refresh Token 自动刷新

支持 token 过期自动刷新，防止并发请求重复刷新。当多个请求同时遇到 401 时，只会触发一次 token 刷新，其他请求会等待刷新完成后自动重试。

```typescript
const http = createClient({
  auth: {
    getToken: () => localStorage.getItem('access_token'),
    refreshToken: {
      getRefreshToken: () => localStorage.getItem('refresh_token')!,
      refresh: async (refreshToken) => {
        const res = await fetch('/api/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        })
        const { accessToken } = await res.json()
        return accessToken
      },
      onRefreshSuccess: (newToken) => {
        localStorage.setItem('access_token', newToken)
      },
      onRefreshFail: () => {
        // 跳转到登录页
        window.location.href = '/login'
      },
    },
  },
})
```

**特性**：
- ✅ 自动检测 401 响应并刷新 token
- ✅ 并发请求去重，多个 401 只刷新一次
- ✅ 刷新成功后自动重试原请求
- ✅ 支持异步回调（`onRefreshSuccess` 可以是 async 函数）
- ✅ POST / PUT / FormData 在 401 后同样能刷新并重试（基于 ky 原生 `ky.retry()`）

### 错误处理

错误分两类，互不混淆：

- **业务错误 `BusinessError`**：HTTP 2xx 但业务 `code` 不符，携带 `code` / `raw` / `response`
- **传输层错误**：ky 原生的 `HTTPError` / `NetworkError` / `TimeoutError` / `ForceRetryError`，均从本包重新导出

```typescript
import { BusinessError, isHTTPError, isTimeoutError } from '@kkfive/request'

try {
  const users = await http.get<User[]>('/users')
}
catch (error) {
  if (error instanceof BusinessError) {
    console.log(error.code, error.raw) // 业务错误码与原始响应体
  }
  else if (isHTTPError(error)) {
    console.log(error.response.status, error.data) // HTTP 错误
  }
  else if (isTimeoutError(error)) {
    // 超时
  }
}
```

### 响应解析

支持三种响应返回模式：

```typescript
const http = createClient({
  responseParser: {
    responseReturn: 'data', // 'raw' | 'body' | 'data'
    codeField: 'code',
    dataField: 'data',
    successCode: 0,
    errorMessageField: 'message',
  },
})

// 不传 unwrap - 跟随实例 responseParser 配置（此处返回 data 字段）
const data = await http.get('/api')

// unwrap: false - 覆盖实例配置，返回完整响应体 { code, data, message }
const response = await http.get('/api', { unwrap: false })
```

### 生命周期回调

```typescript
const http = createClient({
  onRequest: (method, url) => {
    console.log(`[Request] ${method} ${url}`)
  },
  onResponse: (method, url, status) => {
    console.log(`[Response] ${status}`)
  },
  onError: (error, response) => {
    toast.error(error.message)
  },
  onUnauthorized: () => {
    router.push('/login')
  },
})
```

### FormData 上传

自动检测 FormData 并正确处理 Content-Type。

```typescript
const formData = new FormData()
formData.append('file', file)

// 自动移除 Content-Type，让浏览器设置 multipart/form-data
await http.post('/upload', formData)
```

### 请求取消

```typescript
const controller = Request.createAbortController()

http.get('/api', { signal: controller.signal })

// 取消请求
controller.abort()
```

### 访问底层实例

用于特殊场景（下载文件、获取纯文本等）。

```typescript
// 下载文件
const blob = await http.raw.get('/download').blob()

// 获取纯文本
const text = await http.raw.get('/markdown').text()
```

### SSE 流式请求

基于 [parse-sse](https://github.com/sindresorhus/parse-sse) 实现 SSE 流式请求，支持 async iteration 和 emitter 两种消费模式。

#### 高层 API：一步完成请求 + 消费

```typescript
import { createClient, createSSEStream } from '@kkfive/request'

const client = createClient({
  prefix: 'https://api.openai.com/v1',
  auth: { getToken: () => 'sk-xxx' },
})

// Async iteration 模式
const stream = createSSEStream(client.raw, '/chat/completions', {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
})

for await (const event of stream) {
  const content = event.data?.choices?.[0]?.delta?.content
  if (content) process.stdout.write(content)
}
```

#### Emitter 模式：多监听器

```typescript
const stream = createSSEStream(client.raw, '/chat/completions', body)

stream
  .on('data', (event) => {
    renderUI(event.data)
  })
  .on('error', (error) => {
    reportToSentry(error)
  })
  .on('close', () => {
    cleanup()
  })

await stream.done
```

#### 底层 API：接收已有 Response

用于需要自定义请求参数的场景。

```typescript
import { createSSEStreamFromResponse } from '@kkfive/request'

// 自定义请求参数
const response = await client.raw('sse/chat', {
  method: 'POST',
  headers: { 'X-Custom': 'value' },
  json: { messages },
})

const stream = createSSEStreamFromResponse(response)

for await (const event of stream) {
  console.log(event.data)
}
```

#### SSE 配置

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `parser` | `'json' \| 'text'` | `'json'` | data 字段解析方式 |
| `doneSignal` | `string \| null` | `'[DONE]'` | 流结束信号，`null` 禁用 |
| `signal` | `AbortSignal` | - | 取消信号 |
| `timeout` | `number` | - | 超时时间（ms） |
| `method` | `string` | `'POST'` | HTTP 方法 |
| `headers` | `Record<string, string>` | - | 额外 headers |
| `body` | `unknown` | - | 请求体 |

## 配合 @tanstack/query

kk-request 负责业务层封装；缓存、重试、去重交给 @tanstack/query，职责分明。

### 基础集成

```typescript
import { createClient } from '@kkfive/request'
import { useQuery } from '@tanstack/react-query'

const http = createClient({
  prefix: 'https://api.example.com',
  responseParser: { responseReturn: 'data' },
})

function UserList() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => http.get<User[]>('/users'),
  })

  if (isLoading)
    return <div>Loading...</div>
  return <div>{data?.map(user => <div key={user.id}>{user.name}</div>)}</div>
}
```

### 带缓存和重试

```typescript
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: () => http.get<User[]>('/users'),
  staleTime: 60000, // 缓存 1 分钟（由 @tanstack/query 处理）
  retry: 3, // 失败重试 3 次（由 @tanstack/query 处理）
})
```

### Mutation 示例

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

function CreateUser() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (newUser: CreateUserDto) => http.post<User>('/users', newUser),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  return <form onSubmit={() => mutation.mutate({ name: 'test' })}>{/* ... */}</form>
}
```

## API 参考

### createClient(options?)

创建请求客户端实例。

#### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `prefix` | `string` | - | 请求 URL 前缀（ky 2.0，取代旧的 `prefixUrl`） |
| `timeout` | `number` | `10000` | 超时时间（毫秒） |
| `headers` | `Record<string, string>` | - | 请求头 |
| `responseParser` | `ResponseParserOptions` | - | 响应解析配置 |
| `auth` | `AuthOptions` | - | 认证配置 |
| `getHeaders` | `() => Record<string, string>` | - | 动态获取额外 headers |
| `onRequest` | `(method, url) => void` | - | 请求发送前回调 |
| `onResponse` | `(method, url, status) => void` | - | 响应返回后回调 |
| `onError` | `(error: Error, response?) => void` | - | 错误发生时回调（业务错误为 BusinessError，传输错误为 ky 原生类型） |
| `onUnauthorized` | `() => void` | - | 401 未授权时回调 |

#### AuthOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `getToken` | `() => string \| null \| Promise<string \| null>` | - | 获取 token 函数 |
| `headerName` | `string` | `'Authorization'` | token header 名称 |
| `scheme` | `string \| null` | `'Bearer'` | token 前缀，null 表示不加前缀 |
| `refreshToken` | `RefreshTokenOptions` | - | refresh token 配置 |

#### RefreshTokenOptions

| 选项 | 类型 | 说明 |
|------|------|------|
| `getRefreshToken` | `() => string \| Promise<string>` | 获取 refresh token 函数 |
| `refresh` | `(refreshToken: string) => Promise<string>` | 刷新 token 函数，返回新的 access token |
| `onRefreshSuccess` | `(newToken: string) => void` | token 刷新成功回调 |
| `onRefreshFail` | `(error: Error) => void` | token 刷新失败回调 |

#### ResponseParserOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `responseReturn` | `'raw' \| 'body' \| 'data'` | `'body'` | 响应返回模式 |
| `codeField` | `string` | `'code'` | 业务状态码字段 |
| `dataField` | `string \| ((res) => any)` | `'data'` | 数据字段 |
| `successCode` | `number \| string \| ((code) => boolean)` | `0` | 成功状态码 |
| `errorMessageField` | `string \| ((res) => string)` | `'message'` | 错误信息字段 |

### 请求方法

```typescript
http.get<T>(url, config?)
http.post<T>(url, data?, config?)
http.put<T>(url, data?, config?)
http.patch<T>(url, data?, config?)
http.delete<T>(url, config?)
```

### 请求级配置

| 选项 | 类型 | 说明 |
|------|------|------|
| `unwrap` | `boolean` | 是否解包响应，只返回 data 字段 |
| `timeout` | `number` | 覆盖实例级超时时间 |
| `signal` | `AbortSignal` | 取消信号 |
| `params` | `Record<string, any>` | URL 查询参数 |
| `paramsSerializer` | `'brackets' \| 'comma' \| 'indices' \| 'repeat'` | 参数序列化方式 |

## 依赖

- [ky](https://github.com/sindresorhus/ky) - HTTP 客户端
- [qs](https://github.com/ljharb/qs) - 查询字符串解析
- [parse-sse](https://github.com/sindresorhus/parse-sse) - SSE 流解析

## License

[MIT](./LICENSE) License © [DreamyTZK](https://github.com/kkfive)
