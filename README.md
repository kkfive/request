<!-- eslint-skip -->

# @kkfive/request

[![npm version](https://img.shields.io/npm/v/@kkfive/request.svg)](https://www.npmjs.com/package/@kkfive/request)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 一个基于 [ky](https://github.com/sindresorhus/ky) 的轻量级、类型安全的 HTTP 请求库

## ✨ 特性

- 🎯 **类型安全** - 完整的 TypeScript 支持，提供优秀的类型推导
- 🔄 **响应解析** - 三种响应模式（raw/body/data），自动解析和验证响应数据
- 🛡️ **错误处理** - 增强的 RequestError 类，提供 9 个辅助方法用于错误判断
- 🔌 **灵活扩展** - 支持实例扩展（extend）和 Hooks 机制
- 📦 **轻量级** - 基于 ky 封装，保持简洁和高性能
- 🎨 **易于使用** - 简洁的 API 设计，符合直觉的使用方式

## 📦 安装

```bash
# pnpm
pnpm add @kkfive/request ky qs

# npm
npm install @kkfive/request ky qs

# yarn
yarn add @kkfive/request ky qs
```

> **注意**：`ky` 和 `qs` 是 peer dependencies，需要手动安装。

> **兼容性提示**：本库为 ESM-only，需运行在 Node.js 18+ 或任一支持 ESM 的构建环境；CommonJS 项目可使用 `await import('@kkfive/request')` 动态加载。

## 🚀 快速开始

### 基础使用

```typescript
import { Request } from '@kkfive/request'

// 创建请求实例
const request = new Request({
  prefixUrl: 'https://api.example.com',
  timeout: 10000,
})

// 发送 GET 请求
const data = await request.get('/users/1')
console.log('用户数据:', data)

// 发送 POST 请求
const newUser = await request.post('/users', {
  name: '张三',
  email: 'zhangsan@example.com',
})
```

### 最简调用（内置实例）

直接使用库内置的 `request` 实例即可完成一次请求，也可以配合 `extend` 派生新实例：

```typescript
import { request } from '@kkfive/request'

const user = await request.get('/users/1', {
  prefixUrl: 'https://api.example.com',
})

const authedRequest = request.extend({
  headers: { Authorization: 'Bearer token' },
})
```

### 响应解析器

自动解析和验证响应数据，支持三种模式：

```typescript
const request = new Request({
  prefixUrl: 'https://api.example.com',
  responseParser: {
    responseReturn: 'data', // 'raw' | 'body' | 'data'
    codeField: 'code', // 业务状态码字段
    dataField: 'data', // 数据字段
    successCode: 0, // 成功状态码
    errorMessageField: 'message',
  },
})

// 自动提取 data 字段，验证业务状态码
const userData = await request.get('/users/1')
// userData 直接是 data 字段的内容
```

### 错误处理

增强的 RequestError 类提供丰富的错误判断方法：

```typescript
try {
  const data = await request.get('/api/data')
  console.log('数据:', data)
}
catch (error) {
  const err = error as RequestError

  if (err.isBusinessError) {
    // 业务错误（HTTP 200 但业务 code 不匹配）
    console.log('业务错误:', err.message)
  }
  else if (err.is4xxError()) {
    // 4xx 客户端错误
    if (err.isHttpError(401)) {
      console.log('未授权，需要登录')
    }
  }
  else if (err.is5xxError()) {
    // 5xx 服务器错误
    console.log('服务器错误，请稍后重试')
  }
  else if (err.isTimeout()) {
    // 超时错误
    console.log('请求超时')
  }

  // 格式化输出
  console.log(err.toString())
  // 输出: 业务错误 [500]: 接口响应失败
}
```

### 实例扩展

使用 `extend()` 创建派生实例，继承并扩展配置：

```typescript
// 创建基础实例
const baseRequest = Request.create({
  prefixUrl: 'https://api.example.com',
  timeout: 10000,
})

// 创建带认证的派生实例
const authRequest = baseRequest.extend({
  headers: {
    Authorization: 'Bearer your-token',
  },
})

// 创建管理员派生实例
const adminRequest = authRequest.extend({
  headers: {
    'X-Admin-Token': 'admin-secret',
  },
})
```

## 📚 API 文档

### Request 类

#### 构造函数

```typescript
new Request(options?: RequestOption)
```

#### 静态方法

- `Request.create(options?: RequestOption): Request` - 创建新实例

#### 实例方法

- `get<T>(url: string, config?: RequestOption): Promise<T>` - GET 请求
- `post<T>(url: string, data?: unknown, config?: RequestOption): Promise<T>` - POST 请求
- `put<T>(url: string, data?: unknown, config?: RequestOption): Promise<T>` - PUT 请求
- `patch<T>(url: string, data?: unknown, config?: RequestOption): Promise<T>` - PATCH 请求
- `delete<T>(url: string, data?: unknown, config?: RequestOption): Promise<T>` - DELETE 请求
- `head(url: string, config?: RequestOption): Promise<Response>` - HEAD 请求
- `options(url: string, config?: RequestOption): Promise<Response>` - OPTIONS 请求
- `extend(options: RequestOption): Request` - 创建派生实例

### RequestOption 配置

```typescript
interface RequestOption {
  // ky 的所有配置项
  prefixUrl?: string
  timeout?: number
  headers?: Record<string, string>

  // 扩展配置
  params?: Record<string, any>
  paramsSerializer?: 'brackets' | 'comma' | 'indices' | 'repeat'
  responseParser?: ResponseParserOptions
  makeErrorMessage?: (message: string, error: RequestError) => void
  hooks?: {
    beforeRequest?: Array<(request: Request, options: Options) => void>
    afterResponse?: Array<(request: Request, options: Options, response: Response) => Response>
  }
}
```

### ResponseParserOptions 配置

```typescript
type ResponseParserOptions
  = | { responseReturn: 'raw' } // 返回原始 Response 对象
    | { responseReturn: 'body' } // 返回完整响应体
    | {
      responseReturn: 'data' // 提取数据字段并验证
      codeField?: string // 业务状态码字段，默认 'code'
      dataField?: string | ((res: any) => any) // 数据字段，默认 'data'
      successCode?: number | string | ((code: any) => boolean) // 成功状态码，默认 0
      errorCodeField?: string // 错误码字段
      errorMessageField?: string | ((res: any) => string) // 错误信息字段
    }
```

### RequestError 类

#### 属性

- `message: string` - 错误信息
- `code?: string | number` - 错误码
- `raw?: any` - 原始响应体
- `response?: Response` - 原始 Response 对象
- `isBusinessError: boolean` - 是否是业务错误
- `options?: RequestOption` - 请求配置

#### 方法

- `isNetworkError(): boolean` - 判断是否是网络错误
- `isHttpError(status?: number): boolean` - 判断是否是 HTTP 错误
- `is4xxError(): boolean` - 判断是否是 4xx 客户端错误
- `is5xxError(): boolean` - 判断是否是 5xx 服务器错误
- `isTimeout(): boolean` - 判断是否是超时错误
- `toString(): string` - 格式化错误信息
- `toJSON(): object` - 转换为 JSON 对象

## 📖 示例

查看 [examples](./examples) 目录获取更多详细示例：

- [01-basic-usage.ts](./examples/01-basic-usage.ts) - 基础使用示例
- [02-response-parser.ts](./examples/02-response-parser.ts) - 响应解析器示例
- [03-error-handling.ts](./examples/03-error-handling.ts) - 错误处理示例
- [04-advanced-features.ts](./examples/04-advanced-features.ts) - 高级特性示例
- [index.ts](./examples/index.ts) - 综合示例

运行示例：

```bash
# 运行综合示例
npm run start:example

# 运行特定示例
npm run start:example -- examples/01-basic-usage.ts
```

## 🎯 设计理念

本库遵循以下设计理念：

1. **专注核心功能** - 只做请求和响应处理，不包含缓存、自动重试等高级功能
2. **类型安全优先** - 提供完整的 TypeScript 类型支持
3. **简洁易用** - API 设计简洁直观，学习成本低
4. **灵活扩展** - 通过 Hooks 和实例扩展机制支持定制化需求

对于缓存、自动请求、请求去重等高级功能，建议使用上层框架如 [TanStack Query](https://tanstack.com/query) 来实现。

## 🔧 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 运行测试
pnpm test

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 构建
pnpm build
```

## 🧪 测试

本项目使用 Vitest 进行单元测试。

测试 API 文档：[Apifox Mock API](https://zet8c558g2.apifox.cn/)


## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

[MIT](./LICENSE) License © 2024 [DreamyTZK](https://github.com/kkfive)

## 🙏 致谢

- [ky](https://github.com/sindresorhus/ky) - 优秀的 HTTP 客户端
- [qs](https://github.com/ljharb/qs) - 查询字符串解析和序列化库
