# @kkfive/request

基于 [ky](https://github.com/sindresorhus/ky) 的轻量级 HTTP 客户端封装，提供开箱即用的 Token 注入、响应解析、生命周期回调等功能。

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
