# 快速开始（5 分钟上手）

[← README](../README.md) ｜ 改 kk-request 库本身请见 [skills/kk-request/SKILL.md](../skills/kk-request/SKILL.md)

本教程只覆盖渐进式上手路径。**完整功能与 API 全表见 [README](../README.md)**；可运行示例见 [`examples/index.ts`](../examples/index.ts)。

## 安装

```bash
pnpm add @kkfive/request
```

> ky / qs / parse-sse 已作为直接依赖随包安装，无需手动安装。

## 第 1 步：最简请求

```typescript
import { createClient } from '@kkfive/request'

const http = createClient({ prefix: 'https://api.example.com' })

const users = await http.get<User[]>('/users')
const user = await http.post<User>('/users', { name: 'test' })
```

## 第 2 步：自动解析业务响应

后端返回 `{ code, data, message }` 时，用 `data` 模式自动解包，直接拿到 `data`：

```typescript
const http = createClient({
  prefix: 'https://api.example.com',
  responseParser: { responseReturn: 'data', codeField: 'code', dataField: 'data', successCode: 0 },
})

const users = await http.get<User[]>('/users') // 直接拿到 data 字段
```

> 三种响应模式（raw / body / data）详解见 [README → 响应解析](../README.md#响应解析)。

## 第 3 步：带 Token

```typescript
const http = createClient({
  prefix: 'https://api.example.com',
  auth: { getToken: () => localStorage.getItem('access_token') },
})
```

> `headerName` / `scheme` 等选项见 [README → Token 注入](../README.md#token-注入)。

## 第 4 步：401 自动刷新

```typescript
const http = createClient({
  prefix: 'https://api.example.com',
  auth: {
    getToken: () => localStorage.getItem('access_token'),
    refreshToken: {
      getRefreshToken: () => localStorage.getItem('refresh_token')!,
      refresh: async (rt) => {
        const res = await fetch('/api/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: rt }) })
        return (await res.json()).accessToken
      },
      onRefreshSuccess: t => localStorage.setItem('access_token', t),
      onRefreshFail: () => { window.location.href = '/login' },
    },
  },
})
```

> 并发去重、刷新机制详解见 [README → Refresh Token 自动刷新](../README.md#refresh-token-自动刷新)。

## 下一步

- **完整功能与 API 全表** → [README](../README.md)
- **配合 @tanstack/query / 错误处理 / SSE** → [README](../README.md) 对应小节
- **可运行示例** → [`examples/index.ts`](../examples/index.ts)
- **改 kk-request 库本身** → [skills/kk-request/SKILL.md](../skills/kk-request/SKILL.md)
