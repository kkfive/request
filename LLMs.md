# LLMs.md — kk-request AI 导航中枢

`@kkfive/request`：基于 [ky](https://github.com/sindresorhus/ky) 的轻量级**业务层 HTTP 客户端封装**。
本文件是给 AI 的总门户——**仅索引与指针，不复制正文**。

## 能力概览

**做什么**：token 注入 · 401 自动刷新重试 · 响应解析（raw / body / data）· 业务错误 `BusinessError` · 生命周期回调 · SSE 流式 · 透传 ky 原生错误类型与类型守卫。

**不做什么**（交给专业工具）：缓存 / 去重 / 通用重试 → @tanstack/query（**401 刷新重试是内置例外**）；HTTP / 超时 / 取消 → ky。

---

## 🛠 改 kk-request 库本身（开发侧）

→ 读 [`.agents/skills/kk-request/SKILL.md`](.agents/skills/kk-request/SKILL.md)，按其 **Common Tasks** 路由。

- 规则（必读约束）：[boundaries](.agents/skills/kk-request/rules/boundaries.md) · [hook-authoring](.agents/skills/kk-request/rules/hook-authoring.md) · [error-model](.agents/skills/kk-request/rules/error-model.md)
- 工作流：[add-custom-hook](.agents/skills/kk-request/workflows/add-custom-hook.md)
- 参考：[architecture](.agents/skills/kk-request/references/architecture.md) · [design-decisions](.agents/skills/kk-request/references/design-decisions.md) · [gotchas](.agents/skills/kk-request/references/gotchas.md)

## 📦 用 kk-request 写业务（使用侧）

| 我要 | 去哪 |
|---|---|
| 跑通最简请求（5 分钟） | [README → 快速开始](README.md#快速开始) |
| 配 auth + 401 刷新 | [README → Refresh Token 自动刷新](README.md#refresh-token-自动刷新) |
| 选响应模式（raw/body/data） | [README → 响应解析](README.md#响应解析) |
| 区分 BusinessError / 传输错误 | [README → 错误处理](README.md#错误处理) |
| SSE 流式 | [README → SSE 流式请求](README.md#sse-流式请求) |
| schema 校验响应（zod/valibot…） | [README → Schema 校验](README.md#schema-校验) · [`examples/index.ts`](examples/index.ts) |
| 完整 API 全表 | [README → API 参考](README.md#api-参考) |
| 可运行示例 | [`examples/index.ts`](examples/index.ts) |
| 浓缩用法卡（外部消费 AI） | [`llms.txt`](llms.txt) |

---

## 入口文件

- [`AGENTS.md`](AGENTS.md) — 规范入口（canonical），codex 等通用工具读它。
- [`CLAUDE.md`](CLAUDE.md) — Claude Code 薄壳（路由内容与 AGENTS.md 一致 + 自动激活说明）。
- `.claude/skills/kk-request/` — Claude Code 注册 stub，按 description 自动激活后指向 `.agents/skills/kk-request/` 的正式 skill。
