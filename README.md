# @kkfive/request

基于 [ky](https://github.com/sindresorhus/ky) 的轻量级 HTTP 客户端封装层，专注于业务层请求封装。

## 项目定位

**kk-request 是一个封装层，不是完整的 HTTP 客户端**。它专注于提供业务层的请求封装能力：

- ✅ Token 注入（支持 refresh token 自动刷新）
- ✅ 响应解析
- ✅ 业务错误处理
- ✅ 生命周期回调
- ✅ 国际化错误消息

**高级功能交由专业工具处理**：

- 缓存、重试、去重 → [@tanstack/query](https://tanstack.com/query)
- HTTP 请求、超时、取消 → [ky](https://github.com/sindresorhus/ky)

## 两种使用方式

### 1. 简单项目直接使用

适合不需要复杂功能的项目，通过简单配置即可开箱即用：

```typescript
const http = createClient({
  prefixUrl: 'https://api.example.com',
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
pnpm add @kkfive/request ky qs
```

## 快速开始

```typescript
import { createClient } from '@kkfive/request'

const http = createClient({
  prefixUrl: 'https://api.example.com',
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

## 功能特性

### Token 注入

支持异步获取 token，自定义 header 名称和前缀方案。

```typescript
const http = createClient({
  prefixUrl: 'https://api.example.com',
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
- ✅ FormData 上传自动优化，跳过 body clone 以减少内存占用

### 国际化错误消息

支持中英文错误消息：

```typescript
const http = createClient({
  locale: 'en', // 'zh' | 'en'，默认 'zh'
  responseParser: {
    responseReturn: 'data',
  },
})
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

// unwrap: true (默认) - 只返回 data 字段
const data = await http.get('/api')

// unwrap: false - 返回完整响应体 { code, data, message }
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

## API 参考

### createClient(options?)

创建请求客户端实例。

#### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `prefixUrl` | `string` | - | 请求 URL 前缀 |
| `timeout` | `number` | `10000` | 超时时间（毫秒） |
| `headers` | `Record<string, string>` | - | 请求头 |
| `responseParser` | `ResponseParserOptions` | - | 响应解析配置 |
| `auth` | `AuthOptions` | - | 认证配置 |
| `getHeaders` | `() => Record<string, string>` | - | 动态获取额外 headers |
| `locale` | `'zh' \| 'en'` | `'zh'` | 错误消息语言 |
| `onRequest` | `(method, url) => void` | - | 请求发送前回调 |
| `onResponse` | `(method, url, status) => void` | - | 响应返回后回调 |
| `onError` | `(error, response?) => void` | - | 错误发生时回调 |
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

## License

[MIT](./LICENSE) License © [DreamyTZK](https://github.com/kkfive)
