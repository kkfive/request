# kk-request

> **规范入口是 [`AGENTS.md`](AGENTS.md)，请先读它。** 本文件是 Claude Code 薄壳：路由内容与 `AGENTS.md` 一致，复制于此以抗 `/compact` 截断。

`@kkfive/request`：基于 [ky](https://github.com/sindresorhus/ky) 的轻量级**业务层 HTTP 客户端封装**（token 注入 / 401 自动刷新 / 响应解析 / `BusinessError` / SSE）。**封装层，非完整 HTTP 客户端。**

<task-routing>
- **改库本身**（hook / 401 刷新 / 响应解析 / 错误模型 / SSE）→ 读 [`skills/kk-request/SKILL.md`](skills/kk-request/SKILL.md)，按 **Common Tasks** 路由；改库前先读 [`skills/kk-request/rules/boundaries.md`](skills/kk-request/rules/boundaries.md)。
- **用库写业务**（调用 API、集成）→ 读 [`LLMs.md`](LLMs.md) 使用侧轨 + [`README.md`](README.md) + 可运行示例 [`examples/`](examples/)。
</task-routing>

> **Claude Code 专属**：`.claude/skills/kk-request/` 已注册，可按 description 自动激活；激活后立即读 [`skills/kk-request/SKILL.md`](skills/kk-request/SKILL.md) 并按 Common Tasks 路由。

开发命令、Auto-Triggers 等完整内容见 [`AGENTS.md`](AGENTS.md)。
