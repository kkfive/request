# 快速开始

[← 返回 CLAUDE.md](../CLAUDE.md)

## 安装

```bash
pnpm add @kkfive/request ky qs
```

## 基础使用

### 最简配置

```typescript
import { createClient } from '@kkfive/request'

const http = createClient({
  prefixUrl: 'https://api.example.com',
})

// GET 请求
const users = await http.get<User[]>('/users')

// POST 请求
const user = await http.post<User>('/users', { name: 'test' })
```

### 带响应解析

```typescript
const http = createClient({
  prefixUrl: 'https://api.example.com',
  responseParser: {
    responseReturn: 'data',  // 只返回 data 字段
    codeField: 'code',       // 业务状态码字段
    dataField: 'data',       // 数据字段
    successCode: 0,          // 成功状态码
  },
})

// 自动解析响应，只返回 data 字段
const users = await http.get<User[]>('/users')
```

### 带 Token 认证

```typescript
const http = createClient({
  prefixUrl: 'https://api.example.com',
  auth: {
    getToken: () => localStorage.getItem('access_token'),
    headerName: 'Authorization',  // 默认值
    scheme: 'Bearer',              // 默认值
  },
})

// 自动在请求头中添加：Authorization: Bearer <token>
const users = await http.get<User[]>('/users')
```

### 带 Token 自动刷新

```typescript
const http = createClient({
  prefixUrl: 'https://api.example.com',
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
        window.location.href = '/login'
      },
    },
  },
})

// 遇到 401 自动刷新 token 并重试
const users = await http.get<User[]>('/users')
```

## 配合 @tanstack/query

### 基础集成

```typescript
import { createClient } from '@kkfive/request'
import { useQuery } from '@tanstack/react-query'

// 创建 HTTP 客户端
const http = createClient({
  prefixUrl: 'https://api.example.com',
  responseParser: { responseReturn: 'data' },
})

// 在 React Query 中使用
function UserList() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => http.get<User[]>('/users'),
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {data?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  )
}
```

### 带缓存和重试

```typescript
function UserList() {
  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => http.get<User[]>('/users'),
    staleTime: 60000,   // 缓存 1 分钟（由 @tanstack/query 处理）
    retry: 3,           // 失败重试 3 次（由 @tanstack/query 处理）
  })

  return <div>{/* ... */}</div>
}
```

### Mutation 示例

```typescript
function CreateUser() {
  const mutation = useMutation({
    mutationFn: (newUser: CreateUserDto) =>
      http.post<User>('/users', newUser),
    onSuccess: () => {
      // 刷新用户列表
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleSubmit = (data: CreateUserDto) => {
    mutation.mutate(data)
  }

  return <form onSubmit={handleSubmit}>{/* ... */}</form>
}
```

## 常见配置

### 生命周期回调

```typescript
const http = createClient({
  prefixUrl: 'https://api.example.com',
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

### 自定义 Headers

```typescript
const http = createClient({
  prefixUrl: 'https://api.example.com',
  headers: {
    'X-App-Version': '1.0.0',
  },
  getHeaders: () => ({
    'X-Request-Time': Date.now().toString(),
  }),
})
```

### 超时配置

```typescript
const http = createClient({
  prefixUrl: 'https://api.example.com',
  timeout: 10000, // 10 秒
})

// 请求级覆盖
await http.get('/users', { timeout: 5000 })
```

### URL 参数序列化

```typescript
const http = createClient({
  prefixUrl: 'https://api.example.com',
})

// 使用 params
await http.get('/users', {
  params: { ids: [1, 2, 3], status: 'active' },
  paramsSerializer: 'comma', // ids=1,2,3&status=active
})

// 其他序列化方式：
// 'brackets': ids[]=1&ids[]=2&ids[]=3
// 'indices': ids[0]=1&ids[1]=2&ids[2]=3
// 'repeat': ids=1&ids=2&ids=3
```

### FormData 上传

```typescript
const formData = new FormData()
formData.append('file', file)
formData.append('name', 'avatar')

// 自动处理 Content-Type
await http.post('/upload', formData)
```

### 请求取消

```typescript
const controller = Request.createAbortController()

http.get('/api', { signal: controller.signal })

// 取消请求
controller.abort()
```

### 访问底层 ky 实例

```typescript
// 下载文件
const blob = await http.raw.get('/download').blob()

// 获取纯文本
const text = await http.raw.get('/markdown').text()

// 流式响应
const response = await http.raw.get('/stream')
const reader = response.body?.getReader()
```

## 响应模式

### raw 模式（返回 Response 对象）

```typescript
const http = createClient({
  responseParser: {
    responseReturn: 'raw',
  },
})

const response = await http.get('/users')
const data = await response.json()
```

### body 模式（返回完整响应体）

```typescript
const http = createClient({
  responseParser: {
    responseReturn: 'body',
  },
})

// 返回：{ code: 0, data: [...], message: 'success' }
const response = await http.get('/users')
```

### data 模式（只返回 data 字段）

```typescript
const http = createClient({
  responseParser: {
    responseReturn: 'data',
    codeField: 'code',
    dataField: 'data',
    successCode: 0,
  },
})

// 只返回：[...]
const users = await http.get<User[]>('/users')
```

### 请求级控制

```typescript
const http = createClient({
  responseParser: {
    responseReturn: 'data',
    // ...
  },
})

// 使用实例配置（返回 data）
const data = await http.get('/users')

// 覆盖为返回完整响应体
const response = await http.get('/users', { unwrap: false })
```

## 错误处理

### 捕获错误

```typescript
try {
  const users = await http.get<User[]>('/users')
} catch (error) {
  if (error instanceof RequestError) {
    console.log(error.code)           // 错误代码
    console.log(error.message)        // 错误消息
    console.log(error.response)       // HTTP 响应对象
    console.log(error.isBusinessError) // 是否为业务错误
  }
}
```

### 区分网络错误和业务错误

```typescript
try {
  const users = await http.get<User[]>('/users')
} catch (error) {
  if (error.isBusinessError) {
    // 业务错误（如：code !== 0）
    toast.error(error.message)
  } else {
    // 网络错误（如：404、500）
    toast.error('网络错误，请稍后重试')
  }
}
```

### 全局错误处理

```typescript
const http = createClient({
  onError: (error, response) => {
    if (error.isBusinessError) {
      toast.error(error.message)
    } else {
      toast.error('网络错误')
    }
  },
})
```

## 国际化

```typescript
const http = createClient({
  locale: 'en', // 'zh' | 'en'，默认 'zh'
})

// 错误消息会根据 locale 自动切换
// zh: '请求参数错误'
// en: 'Bad Request'
```

## 下一步

- **开发新功能**：阅读 [Hook 开发指南](./hook-development.md)
- **了解限制**：阅读 [约束和限制](./constraints.md)
- **避免陷阱**：阅读 [常见陷阱](./pitfalls.md)
- **理解架构**：阅读 [架构设计](./architecture.md)

[← 返回 CLAUDE.md](../CLAUDE.md)
