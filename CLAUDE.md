# kk-request

基于 [ky](https://github.com/sindresorhus/ky) 的轻量级 HTTP 客户端封装层，专注于业务层请求封装。

## 快速参考

### 项目定位

**kk-request 是一个封装层，不是完整的 HTTP 客户端**。

- ✅ Token 注入与 401 自动刷新重试（基于 `ky.retry()`）
- ✅ 响应解析与业务错误（`BusinessError`）处理
- ✅ 生命周期回调
- ✅ 透传 ky 原生错误类型与类型守卫

**我们不做的**（交给专业工具）：
- ❌ 缓存 → @tanstack/query
- ❌ 通用重试 → ky / @tanstack/query（401 刷新重试是内置能力）
- ❌ 去重 → @tanstack/query

### 设计哲学

```typescript
1. 专注封装层职责 - 只做业务层封装，不越界
2. 充分利用 ky - HTTP 层交给专业工具
3. 与上层框架配合 - 缓存/重试交给 @tanstack/query
4. 二次封装友好 - 灵活的 Hook 系统
```

### 核心架构

```
src/
├── client/                # Request 类和 createClient（可生长目录）
├── errors/                # BusinessError 业务错误类（可生长目录）
├── hooks/                 # Hook 系统（registry + 5 个内置 hooks）
├── sse/                   # SSE 流式请求（含就近的 types.ts）
├── types/                 # 配置/钩子/响应类型定义
└── utils/                 # 工具函数
```

**Hook 执行顺序**（ky 2.0 state 对象签名 `({ request, options, response, retryCount }) => ...`）：
```
beforeRequest: [prepend] → paramsSerializer → auth → contentType → [append]
afterResponse: [prepend] → unauthorized → responseParser → [append]
```

### 关键设计决策

1. **Hook 系统** - 可插拔、可扩展、职责分离
2. **`ky.retry()` 401 重试** - 复用 ky 原生强制重试，POST/FormData 均支持，无需 WeakMap/标记 hook
3. **闭包级 Promise** - 并发 401 去重，只刷新一次 token
4. **错误分层** - `BusinessError`（业务错误）vs ky 原生传输错误（HTTPError/NetworkError/...），互不混淆

### 开发命令

```bash
pnpm build      # 构建项目
pnpm test       # 运行测试
pnpm lint       # 代码检查
pnpm release    # 发布版本
```

---

## 详细文档索引

### 何时阅读哪个文档？

**快速上手**：
- `docs/getting-started.md` - 安装、基础使用、常见配置

**理解架构和设计**：
- `docs/architecture.md` - 详细的架构说明和模块职责
- `docs/design-decisions.md` - 4 个关键设计决策的深入解释

**开发新功能**：
- `docs/hook-development.md` - Hook 开发模式和最佳实践

**修复 Bug 或重构**：
- `docs/pitfalls.md` - 常见陷阱和解决方案
- `docs/constraints.md` - 技术限制和边界

---

## 最小示例

```typescript
import { createClient } from '@kkfive/request'

const http = createClient({
  prefix: 'https://api.example.com',
  responseParser: { responseReturn: 'data' },
})

const users = await http.get<User[]>('/users')
```

更多示例见：`docs/getting-started.md`

---

## ⚠️ 重要提醒

### 在修改代码前必读

1. **自定义 hook 使用 ky 2.0 的 state 对象签名** - `({ request, options, response, retryCount }) => ...`，不是位置参数
2. **传输错误是 ky 原生类型** - 用 `isHTTPError` 等守卫处理；`BusinessError` 仅表示业务错误（2xx + code≠success）
3. **afterResponse hook 读取 body 前必须 clone** - body 只能读取一次

详见：`docs/pitfalls.md`

---

## 相关资源

- **GitHub**: https://github.com/kkfive/request
- **NPM**: https://www.npmjs.com/package/@kkfive/request
- **ky 文档**: https://github.com/sindresorhus/ky
- **@tanstack/query 文档**: https://tanstack.com/query
