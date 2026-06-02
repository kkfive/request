# Hook 编写硬规则

[← SKILL.md](../SKILL.md)

编写/修改 hook 前必读。每条都是「必须」级约束，违反会导致行为错误。详细原因与对照示例见 [../references/gotchas.md](../references/gotchas.md)。

## 签名（最关键）
- **ALWAYS** 用 ky 2.0 **state 对象**签名：`async ({ request, options, response, retryCount }) => ...`
- **NEVER** 用 1.x 位置参数 `(request, options, response)` —— 在 2.0 下第一个参数会拿到整个 state 对象，其余为 `undefined`，行为完全错误。

## afterResponse
- **ALWAYS** 读 body 前先 `response.clone()` —— body 是流，只能读一次。
- **ALWAYS** 返回 `Response`（或 `ky.retry(...)`）；忘记 `return` 会丢失响应。

## options
- **NEVER** 修改 `options` —— ky 2.0 传入的是 `Object.freeze` 的归一化选项，跨 hooks 共享。
- 需传自定义数据时用 ky 的 `context` 选项。

## 回调
- **ALWAYS** 在 `onRefreshSuccess` / `onRefreshFail` / `onUnauthorized` 内部自行 `try/catch` —— 库会隔离回调异常但仍会打印到控制台。

## 命名与类型
- Hook 工厂：`createXxxHook`；裸 hook：`xxxHook`；配置参数用对象 + 可选项。
- 总是显式标注类型 `BeforeRequestHook` / `AfterResponseHook`（从 `ky` 导入 type）。

## 执行顺序（注册逻辑见 `src/hooks/registry.ts`）
```
beforeRequest: [prepend] → paramsSerializer → auth → contentType → [append]
afterResponse: [prepend] → unauthorized → responseParser → [append]
```

写 hook 的完整步骤与实战场景 → [../workflows/add-custom-hook.md](../workflows/add-custom-hook.md)

[← SKILL.md](../SKILL.md)
