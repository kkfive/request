# 项目边界与限制（Always Read）

[← SKILL.md](../SKILL.md)

kk-request 是基于 ky 的**业务层封装**，不是完整 HTTP 客户端。**修改前先确认改动落在边界内。**

## 做什么（封装层职责）
- ✅ Token 注入 + 401 自动刷新重试（基于 `ky.retry()`）
- ✅ 响应解析（`raw` / `body` / `data`）+ 业务错误 `BusinessError`
- ✅ 生命周期回调（`onRequest` / `onResponse` / `onError` / `onUnauthorized`）
- ✅ SSE 流式请求
- ✅ 透传 ky 原生错误类型与类型守卫

## 不做什么（交给专业工具，勿在本库实现）
- ❌ 缓存 → @tanstack/query
- ❌ 通用重试 → ky 的 `retry` 选项 / @tanstack/query（**401 刷新重试是内置能力，属唯一例外**）
- ❌ 去重 → @tanstack/query
- ❌ 进度监听 → 用 `raw` getter 访问底层 ky 实例自行处理流

> 收到「加缓存 / 加去重 / 加通用重试」类需求时：**不在本库实现**，引导到上述工具。

## 技术限制
- **不支持中途取消 Hook 链**：在 hook 内用条件逻辑跳过，或用 `AbortController` 取消整个请求。
- **401 刷新依赖最新 token**：重试请求会显式写入新 token；若业务后续还靠 `getToken()`，须在 `onRefreshSuccess` 中持久化新 token。

## 依赖与环境（硬约束）
- 运行时依赖（**dependencies**，非 peer）：`ky ^2.0.2`、`qs`、`parse-sse`。
- 本库硬依赖 ky **2.0** API：`ky.retry()` / `prefix`（取代旧 `prefixUrl`）/ state 对象 hook。
- 环境：Node **≥ 22**、现代浏览器 / Deno / Cloudflare Workers；不支持 IE11、Node < 22。
- 消费方做 `instanceof HTTPError` 须从 `@kkfive/request` 导入（避免与自身 ky 副本不一致）。

详细架构见 [../references/architecture.md](../references/architecture.md)。

[← SKILL.md](../SKILL.md)
