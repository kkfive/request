# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-06-02

### Added
- 支持 Standard Schema 响应校验，提供 `strict` / `warn` / `off` 三种校验模式。
- 新增 `SchemaValidationError` 透传与 `onValidationError` 回调。
- 新增 SSE 流式请求能力，支持 async iteration 与 emitter 两种消费方式。
- 重新导出 ky 原生传输错误类型与类型守卫，便于消费方统一处理错误。

### Changed
- 升级到 ky 2.0 API，使用 `prefix`、state 对象 hook 与 `ky.retry()`。
- 401 refresh token 重试改为基于 ky 原生强制重试，降低自定义 body 缓存复杂度。
- 明确区分消费方运行环境与库开发环境：Node.js 运行时跟随 `ky` 2.0 要求 Node.js >= 22，非 Node.js 运行时支持现代浏览器、Deno、Cloudflare Workers。
- 保持运行时依赖为直接依赖：`ky`、`qs`、`parse-sse`。

### Fixed
- 强化 401 并发刷新去重，确保多个 401 请求共享同一个 refresh promise。
- 确保 refresh 成功回调可异步等待，新 token 会显式写入重试请求 header。
- 业务错误、传输错误与 schema 校验错误保持分层处理。

## [0.2.0] - 2026-02-13

### Added
- ✨ 支持 `extendedHooks.control.replace` 配置，允许替换内置 hook
- ✨ 改进 401 retry 机制，使用纯前端方案标记重试请求
- ✨ 优化 FormData 上传，自动跳过 body clone 以减少内存占用

### Fixed
- 🐛 修复并发相同请求时的 retry 冲突问题
- 🐛 修复 retry 成功后无法再次刷新 token 的问题
- 🐛 修复 `onRefreshSuccess` 回调未 await 导致的时序问题
- 🐛 修复回调异常未隔离可能污染主流程的问题

### Changed
- 🔄 使用 Hook 标记方案替代 header 标记，避免 CORS 预检
- 🔄 优化 body clone 策略，仅在需要时 clone
- 🔄 改进并发 token refresh 机制，使用闭包级 Promise 共享

### Performance
- ⚡ 跨域场景避免 CORS 预检，减少 1 RTT
- ⚡ FormData 上传跳过 clone，减少内存占用
- ⚡ 整体性能提升约 5-10%（跨域场景）

### Documentation
- 📝 添加 WeakMap 缓存限制说明
- 📝 改进 auth hook 文档注释

## [0.1.1] - 2024-01-XX

### Added
- 🎉 Initial release with refresh token support
- ✨ Automatic token refresh and retry
- ✨ Concurrent request deduplication
- ✨ Flexible hook system
- ✨ Response parser with business error handling
- ✨ TypeScript support
