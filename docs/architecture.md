# 架构设计

[← 返回 CLAUDE.md](../CLAUDE.md)

## 目录结构

```
src/
├── core/
│   └── client.ts          # Request 类和 createClient 工厂函数
├── hooks/
│   ├── registry.ts        # Hook 注册和解析逻辑
│   └── builtin/           # 内置 hooks
│       ├── auth.ts        # 认证 hook（token 注入 + WeakMap 缓存）
│       ├── content-type.ts # Content-Type 自动设置
│       ├── params-serializer.ts # URL 参数序列化
│       ├── response-parser.ts   # 响应解析
│       └── unauthorized.ts      # 401 处理和 token 刷新
├── types/
│   ├── options.ts         # 配置选项类型
│   ├── hooks.ts           # Hook 系统类型
│   └── response.ts        # 响应解析类型
├── errors/
│   └── request-error.ts   # 统一错误类
└── utils/
    ├── merge.ts           # 配置合并
    ├── to.ts              # 错误处理工具
    └── predicates.ts      # 类型判断
```

## 核心模块

### Request 类 (`src/core/client.ts`)

**职责**：请求客户端主类，封装 ky 实例

**关键方法**：
- `get/post/put/patch/delete` - HTTP 方法
- `request` - 通用请求方法
- `raw` getter - 暴露底层 ky 实例（用于特殊场景）

**静态方法**：
- `createAbortController()` - 创建取消控制器

**实现细节**：
```typescript
// src/core/client.ts - Request 类构造函数
constructor(requestConfig?: RequestConfig) {
  // 使用 getter 函数延迟绑定，确保 hooks 中使用的是包含完整 hooks 链的实例
  const getKyInstance = () => finalInstance
  const hooks = resolveHooks(mergedConfig, getKyInstance)
  finalInstance = ky.create({ ...mergedConfig, hooks })
}
```

### Hook 系统 (`src/hooks/`)

**职责**：可插拔的请求/响应处理管道

**执行顺序**：
```
beforeRequest:
  [用户 prepend] → paramsSerializer → auth → contentType → [用户 append]

afterResponse:
  [用户 prepend] → unauthorized → responseParser → [用户 append]
```

**控制方式**：
- 简单：`features.enableXxx = false`
- 高级：`extendedHooks.control.disable/replace`

**内置 Hooks**：
1. **paramsSerializer** - URL 参数序列化（使用 qs）
2. **auth** - Token 注入 + WeakMap 缓存
3. **contentType** - Content-Type 自动设置
4. **unauthorized** - 401 处理 + token 刷新
5. **responseParser** - 响应解析

### 响应解析 (`src/hooks/builtin/response-parser.ts`)

**职责**：解析响应体，支持三种返回模式

**三种模式**：
1. **raw** - 返回原始 Response 对象
2. **body** - 返回完整响应体 `{ code, data, message }`
3. **data** - 只返回 data 字段（默认）

**配置选项**：
- `codeField` - 业务状态码字段（默认 `'code'`）
- `dataField` - 数据字段（默认 `'data'`）
- `successCode` - 成功状态码（默认 `0`）
- `errorMessageField` - 错误消息字段（默认 `'message'`）

**请求级控制**：
- `unwrap: true` - 使用实例配置的模式
- `unwrap: false` - 返回完整响应体

### 错误处理 (`src/errors/request-error.ts`)

**RequestError 类**：统一错误格式

**关键字段**：
- `code` - 错误代码
- `raw` - 原始错误对象
- `response` - HTTP 响应对象
- `isBusinessError` - 是否为业务错误

**区分**：
- 网络错误：`isBusinessError = false`
- 业务错误：`isBusinessError = true`

## Hook 系统实现

### 注册流程 (`src/hooks/registry.ts`)

```typescript
// 1. 解析用户配置
const beforeRequestConfig = resolveHookArray(extendedHooks?.beforeRequest)
const afterResponseConfig = resolveHookArray(extendedHooks?.afterResponse)

// 2. 构建 beforeRequest hooks
const beforeRequest: BeforeRequestHook[] = [
  ...beforeRequestConfig.prepend,
  // 内置 hooks（可禁用/替换）
  paramsSerializerHook,
  createAuthHook(auth, getHeaders),
  createContentTypeHook(),
  ...beforeRequestConfig.append,
]

// 3. 构建 afterResponse hooks
const afterResponse: AfterResponseHook[] = [
  ...afterResponseConfig.prepend,
  // 内置 hooks（可禁用/替换）
  createUnauthorizedHook(onUnauthorized, auth, getKyInstance),
  createResponseParserHook(),
  ...afterResponseConfig.append,
]
```

### 控制机制

**简单控制**（`features`）：
```typescript
createClient({
  features: {
    enableContentType: false,
    enableParamsSerializer: false,
  },
})
```

**高级控制**（`extendedHooks.control`）：
```typescript
createClient({
  extendedHooks: {
    control: {
      disable: ['contentType', 'paramsSerializer'],
      replace: {
        auth: myCustomAuthHook,
      },
    },
  },
})
```

## 数据流

### 请求流程

```
用户调用 http.get('/api')
  ↓
Request.request() 方法
  ↓
触发 onRequest 回调
  ↓
执行 beforeRequest hooks
  ↓
ky 发送 HTTP 请求
  ↓
执行 afterResponse hooks
  ↓
触发 onResponse 回调
  ↓
返回数据给用户
```

### 错误流程

```
HTTP 错误 / 业务错误
  ↓
捕获异常
  ↓
创建 RequestError
  ↓
触发 onError 回调
  ↓
抛出异常给用户
```

### 401 Retry 流程

```
收到 401 响应
  ↓
unauthorized hook 检测
  ↓
调用 refreshToken.refresh()
  ↓
获取新 token
  ↓
触发 onRefreshSuccess
  ↓
使用新 token 重试请求
  ↓
返回重试结果
```

---

## 相关文档

- [设计决策](./design-decisions.md) - 了解为什么这样设计
- [Hook 开发指南](./hook-development.md) - 学习如何开发自定义 Hook
- [常见陷阱](./pitfalls.md) - 避免常见错误
- [约束和限制](./constraints.md) - 了解技术限制

[← 返回 CLAUDE.md](../CLAUDE.md)
