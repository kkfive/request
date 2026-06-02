import type { StandardSchemaV1 } from '../src'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { BusinessError, createClient, isKyError, SchemaValidationError, to } from '../src'

declare global {
  // eslint-disable-next-line vars-on-top
  var __TEST_SERVER_URL__: string
}

// ---- 手写最小 Standard Schema 校验器（零依赖，验证「不绑定具体校验库」）----

/** 校验值为 string，否则产出 issues */
function stringSchema(): StandardSchemaV1<unknown, string> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: value => (typeof value === 'string'
        ? { value }
        : { issues: [{ message: `expected string, got ${typeof value}` }] }),
    },
  }
}

/** 始终校验失败 */
function failingSchema(): StandardSchemaV1<unknown, unknown> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: () => ({ issues: [{ message: 'always fails', path: ['field'] }] }),
    },
  }
}

/** 始终成功并返回固定值（验证 transform：strict 成功路径返回 result.value） */
function constSchema<T>(out: T): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: () => ({ value: out }),
    },
  }
}

const dataParser = {
  responseReturn: 'data' as const,
  codeField: 'success',
  dataField: 'data',
  successCode: true,
  errorCodeField: 'errorCode',
  errorMessageField: 'errorMessage',
}

describe('schema 校验集成', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = globalThis.__TEST_SERVER_URL__
  })

  describe('不传 schema（回归）', () => {
    it('行为与改动前一致，返回数据', async () => {
      const http = createClient({ prefix: baseUrl, responseParser: dataParser })
      const result = await http.get<string>('/success')
      expect(typeof result).toBe('string')
    })
  })

  describe('strict 模式（默认）', () => {
    it('合法数据应通过并返回数据', async () => {
      const http = createClient({ prefix: baseUrl, responseParser: dataParser })
      const result = await http.get('/success', { schema: stringSchema() })
      expect(typeof result).toBe('string')
    })

    it('非法数据应抛 SchemaValidationError 且非 isKyError', async () => {
      const http = createClient({ prefix: baseUrl, responseParser: dataParser })
      const [error] = await to(http.get('/success', { schema: failingSchema() }))
      expect(error).toBeInstanceOf(SchemaValidationError)
      expect(isKyError(error)).toBe(false)
      expect((error as SchemaValidationError).issues[0]?.message).toBe('always fails')
    })

    it('成功应返回 transform 后的值（result.value）', async () => {
      const http = createClient({ prefix: baseUrl, responseParser: dataParser })
      const result = await http.get('/success', { schema: constSchema('TRANSFORMED') })
      expect(result).toBe('TRANSFORMED')
    })

    it('校验失败不触发 onError / makeErrorMessage（结构错误与传输/业务错误区分）', async () => {
      const onError = vi.fn()
      const makeErrorMessage = vi.fn()
      const http = createClient({
        prefix: baseUrl,
        responseParser: dataParser,
        onError,
        makeErrorMessage,
      })
      const [error] = await to(http.get('/success', { schema: failingSchema() }))
      expect(error).toBeInstanceOf(SchemaValidationError)
      expect(onError).not.toHaveBeenCalled()
      expect(makeErrorMessage).not.toHaveBeenCalled()
    })
  })

  describe('warn 模式', () => {
    it('非法数据不抛，触发 onValidationError，降级返回未 transform 原值', async () => {
      const onValidationError = vi.fn()
      const http = createClient({
        prefix: baseUrl,
        responseParser: dataParser,
        schemaValidation: 'warn',
        onValidationError,
      })
      const result = await http.get('/success', { schema: failingSchema() })
      expect(typeof result).toBe('string')
      expect(onValidationError).toHaveBeenCalledTimes(1)
      expect(onValidationError.mock.calls[0][0][0].message).toBe('always fails')
    })

    it('无 onValidationError 时回退 console.warn', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const http = createClient({ prefix: baseUrl, responseParser: dataParser, schemaValidation: 'warn' })
      await http.get('/success', { schema: failingSchema() })
      expect(warnSpy).toHaveBeenCalledWith(
        '[kk-request] schema 校验失败',
        expect.objectContaining({ issues: expect.any(Array) }),
      )
      warnSpy.mockRestore()
    })

    it('成功数据正常返回，不触发回调', async () => {
      const onValidationError = vi.fn()
      const http = createClient({
        prefix: baseUrl,
        responseParser: dataParser,
        schemaValidation: 'warn',
        onValidationError,
      })
      const result = await http.get('/success', { schema: stringSchema() })
      expect(typeof result).toBe('string')
      expect(onValidationError).not.toHaveBeenCalled()
    })
  })

  describe('off 模式', () => {
    it('不校验，直接返回数据，不抛不 warn', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const http = createClient({ prefix: baseUrl, responseParser: dataParser, schemaValidation: 'off' })
      const result = await http.get('/success', { schema: failingSchema() })
      expect(typeof result).toBe('string')
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('实例级 / 请求级配置', () => {
    it('请求级 schemaValidation 覆盖实例级', async () => {
      const http = createClient({ prefix: baseUrl, responseParser: dataParser, schemaValidation: 'strict' })
      // 实例 strict 会抛，请求级 off 覆盖后不抛
      const result = await http.get('/success', { schema: failingSchema(), schemaValidation: 'off' })
      expect(typeof result).toBe('string')
    })
  })

  describe('schema × unwrap', () => {
    it('unwrap=true 校验提取后的 data（string）', async () => {
      const http = createClient({ prefix: baseUrl, responseParser: dataParser })
      const result = await http.get('/success', { schema: stringSchema(), unwrap: true })
      expect(typeof result).toBe('string')
    })

    it('unwrap=false 校验完整 body（对象，string schema 失败）', async () => {
      const http = createClient({ prefix: baseUrl, responseParser: dataParser })
      const [error] = await to(http.get('/success', { schema: stringSchema(), unwrap: false }))
      expect(error).toBeInstanceOf(SchemaValidationError)
    })
  })

  describe('业务码与 schema 顺序', () => {
    it('业务码失败先抛 BusinessError，不进入 schema 校验', async () => {
      const http = createClient({ prefix: baseUrl, responseParser: dataParser })
      const [error] = await to(http.get('/error/business/500', { schema: failingSchema() }))
      expect(error).toBeInstanceOf(BusinessError)
    })
  })

  describe('body 模式 + schema', () => {
    it('校验完整响应体并返回 transform 值', async () => {
      const http = createClient({ prefix: baseUrl, responseParser: { responseReturn: 'body' } })
      const result = await http.get('/success', { schema: constSchema({ ok: true }) })
      expect(result).toEqual({ ok: true })
    })
  })

  describe('raw 模式 + schema', () => {
    it('warn 一次并返回 Response，不校验', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const http = createClient({ prefix: baseUrl, responseParser: { responseReturn: 'raw' } })
      const result = await http.get('/success', { schema: failingSchema() })
      expect(result).toBeInstanceOf(Response)
      expect(warnSpy).toHaveBeenCalledWith(
        '[kk-request] raw 模式不执行 schema 校验，已忽略传入的 schema',
        expect.objectContaining({ url: expect.any(String) }),
      )
      warnSpy.mockRestore()
    })
  })

  describe('post 带 data + schema', () => {
    it('走 schema 校验路径并返回 transform 值', async () => {
      const http = createClient({ prefix: baseUrl, responseParser: dataParser })
      const result = await http.post('/echo', { hello: 'world' }, { schema: constSchema({ done: 1 }) })
      expect(result).toEqual({ done: 1 })
    })
  })
})
