---
name: kk-request
description: >-
  改 kk-request（@kkfive/request）这个 HTTP 封装库**本身**时使用：改/加 hook（拦截器）、401 刷新/认证逻辑、
  响应解析/业务码、BusinessError 错误模型、Standard Schema 响应校验、SSE 流式实现，或理解其架构与边界。
  触发短语：改一下 hook / 加个拦截器 / 401 刷新有问题 / 响应解析不对 / 新增错误类型 / schema 校验 /
  zod 校验不生效 / modify the auth hook。
  Use when modifying the kk-request library internals (hooks, auth & 401-refresh, response
  parsing, BusinessError, schema validation, SSE). 激活于触及本仓库 src 内部、hook 系统、错误模型、
  schema 校验或 SSE 实现。（用本库 API 写业务请看 LLMs.md 使用侧轨 / README，不在此。）
---

# kk-request（注册 stub）

正式内容在 [`../../../.agents/skills/kk-request/SKILL.md`](../../../.agents/skills/kk-request/SKILL.md)。

**立即读它**，并按其 Common Tasks 表路由到对应 rules / workflows / references。本 stub 不复制规则正文。
