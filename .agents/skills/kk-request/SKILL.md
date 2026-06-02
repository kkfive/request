---
name: kk-request
primary: true
description: >-
  改 kk-request（@kkfive/request）这个 HTTP 封装库**本身**时使用：改/加 hook（拦截器）、401 刷新/认证逻辑、
  响应解析/业务码、BusinessError 错误模型、SSE 流式实现，或理解其架构与边界。触发短语：改一下 hook /
  加个拦截器 / 401 刷新有问题 / 响应解析不对 / 新增错误类型 / modify the auth hook。
  Use when modifying the kk-request library internals (hooks, auth & 401-refresh, response
  parsing, BusinessError, SSE). 激活于触及本仓库 src 内部、hook 系统、错误模型或 SSE 实现。
  （用本库 API 写业务请看 LLMs.md 使用侧轨 / README，不在此。）
---

# kk-request 开发 Skill

修改 **kk-request 库本身**时的导航器。这是基于 ky 的业务层封装（非完整 HTTP 客户端），先读边界再动手。

> 用本库 API 来写业务代码（而非改库）？→ 见 [`../../LLMs.md`](../../LLMs.md) 使用侧轨 + [`../../README.md`](../../README.md)，不是这里。

## Always Read

- [`rules/boundaries.md`](rules/boundaries.md) —— 做什么/不做什么 + 依赖/环境硬约束。**每次任务先读。**

## Common Tasks（按意图路由）

| 你要做的 | 先读 | 实现位置 |
|---|---|---|
| 写/改 hook（拦截器） | [rules/hook-authoring.md](rules/hook-authoring.md) → [workflows/add-custom-hook.md](workflows/add-custom-hook.md) | `src/hooks/` |
| 改 401 / 认证 / token 刷新 | [rules/hook-authoring.md](rules/hook-authoring.md) + [references/design-decisions.md](references/design-decisions.md)（决策 2/3） | `src/hooks/unauthorized.ts`、`src/hooks/auth.ts` |
| 改响应解析 / 业务码 | [references/architecture.md](references/architecture.md)（响应解析一节） | `src/hooks/response-parser.ts` |
| 错误处理 / 新增错误类型 | [rules/error-model.md](rules/error-model.md) | `src/errors/`、`src/hooks/response-parser.ts` |
| 改 SSE 流式 | [references/architecture.md](references/architecture.md) | `src/sse/stream.ts`、`src/sse/types.ts` |
| 理解架构 / 边界 | [references/architecture.md](references/architecture.md) + [rules/boundaries.md](rules/boundaries.md) | — |
| Other | 按文件名就近匹配 [references/](references/) / [rules/](rules/) / [workflows/](workflows/) | — |

## Known Gotchas（3 条最关键不变量，详见 [references/gotchas.md](references/gotchas.md)）

1. **hook 用 state 对象签名** `({ request, options, response, retryCount }) => ...`，不是位置参数。
2. **传输错误是 ky 原生类型**（用 `isHTTPError` 等守卫）；`BusinessError` 仅表示「2xx + 业务 code 不符」。
3. **afterResponse 读 body 前必须 `clone()`** —— body 只能读一次。

## Rule Priority

`rules/*`（必须遵守的 always/never）> `references/*`（理由与详解）。冲突以 rules 为准；rules 未覆盖的细节查 references。

## Project Boundaries

不做缓存 / 通用重试 / 去重（交给 @tanstack/query；401 刷新重试是内置例外）。完整边界见 [rules/boundaries.md](rules/boundaries.md)。
