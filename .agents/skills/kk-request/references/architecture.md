# 架构设计

[← SKILL.md](../SKILL.md)

## 目录结构

```
src/
├── index.ts                # 公共导出入口
├── client/
│   ├── index.ts            # 桶导出
│   └── request.ts          # Request 类和 createClient 工厂函数
├── errors/
│   ├── index.ts            # 桶导出
│   └── business-error.ts   # BusinessError 业务错误类
├── hooks/
│   ├── index.ts            # 桶导出
│   ├── registry.ts         # Hook 注册和解析逻辑
│   ├── auth.ts             # 认证 hook（token 注入）
│   ├── content-type.ts     # Content-Type 自动设置
│   ├── params-serializer.ts# URL 参数序列化
│   ├── response-parser.ts  # 响应解析 + 业务错误判定
│   └── unauthorized.ts     # 401 处理和 token 刷新重试
├── sse/
│   ├── index.ts            # 桶导出
│   ├── stream.ts           # SSE 流式请求（SSEStream 类 + 工厂函数）
│   └── types.ts            # SSE 类型（与实现就近）
├── types/
│   ├── index.ts            # 桶导出
│   ├── options.ts          # 配置选项类型
│   ├── hooks.ts            # Hook 系统类型
│   └── response.ts         # 响应解析类型
└── utils/
    ├── index.ts
    ├── merge.ts            # 配置合并
    ├── predicates.ts       # 类型判断
    └── to.ts               # await-to 错误处理工具
```

> `client/` 与 `errors/` 采用目录组织，便于后续新增 client 变体或错误类型时**只新增文件、不重构**。

## 核心模块

### Request 类 (`src/client/request.ts`)

**职责**：请求客户端主类，封装 ky 实例

**关键方法**：
- `get/post/put/patch/delete` - HTTP 方法
- `request` - 通用请求方法
- `raw` getter - 暴露底层 ky 实例（用于特殊场景）

**静态方法**：
- `createAbortController()` - 创建取消控制器

**实现细节**：
```typescript
// src/client/request.ts - Request 类构造函数
constructor(requestConfig?: RequestConfig) {
  const mergedConfig = merge(defaultConfig, requestConfig || {})
  // 401 重试改用 ky 原生 ky.retry()，hooks 无需回引实例，直接创建即可
  const hooks = resolveHooks(mergedConfig)
  this.instance = ky.create({ ...mergedConfig, hooks })
}
```

### Hook 系统 (`src/hooks/`)

**职责**：可插拔的请求/响应处理管道

> ky 2.0 的 hook 采用 **state 对象**签名：`({ request, options, response, retryCount }) => ...`

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
2. **auth** - Token 注入（+ 额外 headers 注入）
3. **contentType** - Content-Type 自动设置
4. **unauthorized** - 401 处理 + token 刷新重试（基于 `ky.retry()`）
5. **responseParser** - 响应解析 + 业务错误判定

### 响应解析 (`src/hooks/response-parser.ts`)

**职责**：解析响应体，支持三种返回模式

**三种模式**：
1. **raw** - 返回原始 Response 对象
2. **body** - 返回完整响应体 `{ code, data, message }`
3. **data** - 只返回 data 字段（并校验业务 code）

**配置选项**：
- `codeField` - 业务状态码字段（默认 `'code'`）
- `dataField` - 数据字段（默认 `'data'`）
- `successCode` - 成功状态码（默认 `0`）
- `errorMessageField` - 错误消息字段（默认 `'message'`）

**请求级控制**：
- `unwrap: true` - 使用实例配置的 `data` 模式
- `unwrap: false` - 返回完整响应体

### 错误处理 (`src/errors/business-error.ts` + ky 原生错误)

错误分两层，互不混淆（分层规则见 [../rules/error-model.md](../rules/error-model.md)）：

- **业务错误 `BusinessError`**：HTTP 2xx 但业务 `code` 不符。携带 `code`（业务码）、`raw`（原始响应体）、`response`。
- **传输层错误**：原样透传 ky 原生类型 —— `HTTPError`（非 2xx）、`NetworkError`、`TimeoutError`、`ForceRetryError`、`KyError`，均从本包重新导出，配合 `isHTTPError` 等守卫使用。

`Request.request()` 的 catch 块**不做归一/包装**，仅触发 `onError` 等生命周期回调后原样抛出。

## 数据流

### 请求流程

```
用户调用 http.get('users')
  ↓
Request.request() 方法（触发 onRequest 回调）
  ↓
执行 beforeRequest hooks（paramsSerializer → auth → contentType）
  ↓
ky 发送 HTTP 请求
  ↓
执行 afterResponse hooks（unauthorized → responseParser）
  ↓
触发 onResponse 回调 → 返回数据
```

### 错误流程

```
业务错误（2xx + code≠success）→ responseParser 抛出 BusinessError
传输错误（非 2xx / 网络 / 超时）→ ky 抛出 HTTPError / NetworkError / TimeoutError
  ↓
Request.request() catch：触发 onError / makeErrorMessage 回调
  ↓
原样抛出（不归一），上层用 instanceof BusinessError / isHTTPError 区分
```

### 401 刷新重试流程

```
收到 401 响应
  ↓
unauthorized hook 检测（retryCount === 0）
  ↓
调用 refreshToken.refresh()（并发去重）
  ↓
触发 onRefreshSuccess
  ↓
return ky.retry({ request: 携带新 token })  ← 由 ky 完成重发
  ↓
重试响应（retryCount > 0；仍 401 则交给 ky 抛出 HTTPError）
```

## Hook 系统实现

### 注册流程 (`src/hooks/registry.ts`)

```typescript
// 1. 解析用户配置
const beforeRequestConfig = resolveHookArray(extendedHooks?.beforeRequest)
const afterResponseConfig = resolveHookArray(extendedHooks?.afterResponse)

// 2. 构建 beforeRequest hooks（state 对象签名）
const beforeRequest: BeforeRequestHook[] = [
  ...beforeRequestConfig.prepend,
  paramsSerializerHook,
  createAuthHook(auth, getHeaders),
  createContentTypeHook(),
  ...beforeRequestConfig.append,
]

// 3. 构建 afterResponse hooks
const afterResponse: AfterResponseHook[] = [
  ...afterResponseConfig.prepend,
  createUnauthorizedHook(onUnauthorized, auth),
  createResponseParserHook(),
  ...afterResponseConfig.append,
]
```

### 控制机制

**简单控制**（`features`）：
```typescript
createClient({
  features: { enableContentType: false, enableParamsSerializer: false },
})
```

**高级控制**（`extendedHooks.control`）：
```typescript
createClient({
  extendedHooks: {
    control: { disable: ['contentType'], replace: { auth: myCustomAuthHook } },
  },
})
```

---

## 相关文档

- [设计决策](./design-decisions.md) - 了解为什么这样设计
- [Hook 开发指南](../workflows/add-custom-hook.md) - 学习如何开发自定义 Hook
- [常见陷阱](./gotchas.md) - 避免常见错误
- [约束和限制](../rules/boundaries.md) - 了解技术限制

[← SKILL.md](../SKILL.md)
