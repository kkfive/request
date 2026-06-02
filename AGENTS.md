# kk-request — AI Agent 规范入口（canonical）

`@kkfive/request`：基于 [ky](https://github.com/sindresorhus/ky) 的轻量级**业务层 HTTP 客户端封装** —— token 注入、401 自动刷新、响应解析、`BusinessError`、SSE。**封装层，非完整 HTTP 客户端。**

> 本文件是所有 AI 工具的**规范入口**：codex 等读 `AGENTS.md`；Claude Code 见 `CLAUDE.md` 薄壳（内容一致）。

<always-applicable>
- 改库前先读 [`skills/kk-request/rules/boundaries.md`](skills/kk-request/rules/boundaries.md)：做什么 / 不做什么 + 依赖环境硬约束。
- 定位：业务层封装。缓存 / 通用重试 / 去重交给 @tanstack/query（**401 刷新重试是内置例外**）。
</always-applicable>

<task-routing>
两类任务，分轨路由：

1. **改 kk-request 库本身**（hook / 401 刷新 / 响应解析 / 错误模型 / SSE / 架构）：
   读 [`skills/kk-request/SKILL.md`](skills/kk-request/SKILL.md)，按其 **Common Tasks** 表路由到对应 rules / workflows / references。

2. **用 kk-request 写业务**（调用 API、集成到自己项目）：
   读 [`LLMs.md`](LLMs.md) 使用侧轨 + [`README.md`](README.md) + 可运行示例 [`examples/`](examples/)。
</task-routing>

## Auto-Triggers

- **新任务开始** → 重读 [`skills/kk-request/SKILL.md`](skills/kk-request/SKILL.md) 的 Common Tasks。
- **写 / 改 hook 前** → 读 [`skills/kk-request/rules/hook-authoring.md`](skills/kk-request/rules/hook-authoring.md)。
- **改错误处理前** → 读 [`skills/kk-request/rules/error-model.md`](skills/kk-request/rules/error-model.md)。

## 开发命令

```bash
pnpm build      # unbuild 构建
pnpm test       # vitest
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
```

## 相关资源

- **GitHub**: https://github.com/kkfive/request ｜ **NPM**: https://www.npmjs.com/package/@kkfive/request
- **ky**: https://github.com/sindresorhus/ky ｜ **@tanstack/query**: https://tanstack.com/query
