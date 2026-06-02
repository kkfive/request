# 错误模型规则

[← SKILL.md](../SKILL.md)

kk-request 的错误**分两层，互不混淆**。改动错误处理 / 新增错误类型前必读。设计理由见 [../references/design-decisions.md](../references/design-decisions.md) 决策 4。

## 两层错误
| 层 | 类型 | 何时 | 携带 |
|---|---|---|---|
| **业务层** | `BusinessError`（本库独有） | HTTP **2xx** 但业务 `code` ≠ `successCode` | `code` / `raw` / `response` / `options` |
| **传输层** | ky 原生 `HTTPError` / `NetworkError` / `TimeoutError` / `ForceRetryError` / `KyError` | 非 2xx / 网络 / 超时等 | ky 原生字段（`response` / `data` 等） |

## 库内规则
- **NEVER** 在 `Request.request()` 的 catch 块归一/包装错误 —— 仅触发 `onError` 等回调后**原样抛出**。
- **业务错误**只在 `src/hooks/response-parser.ts` 中（业务 code 不符时）抛出 `BusinessError`。
- **传输错误**原样透传 ky 类型，并从本包**重新导出**（含 `isHTTPError` 等守卫）。
- 新增错误类型 → 放 `src/errors/`（目录式，只新增文件不重构）。

## 消费方区分（守卫顺序）
```typescript
import { BusinessError, isHTTPError, isNetworkError, isTimeoutError } from '@kkfive/request'

try { /* await http.get(...) */ }
catch (e) {
  if (e instanceof BusinessError) { /* 业务失败：e.code（业务码）/ e.raw（原始体）*/ }
  else if (isHTTPError(e)) { /* HTTP 4xx/5xx：e.response.status / e.data */ }
  else if (isTimeoutError(e)) { /* 超时 */ }
  else if (isNetworkError(e)) { /* 网络 */ }
}
```
- **ALWAYS** 先判 `instanceof BusinessError`（它是 2xx 业务失败，不会被 ky 守卫命中），再用 ky 守卫。

[← SKILL.md](../SKILL.md)
