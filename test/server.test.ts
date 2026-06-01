import type { ApiResponse, EchoData } from './types'
import { beforeAll, describe, expect, it } from 'vitest'

declare global {
  // eslint-disable-next-line vars-on-top
  var __TEST_SERVER_URL__: string
}

describe('测试服务器端点验证', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = globalThis.__TEST_SERVER_URL__
  })

  describe('成功响应端点', () => {
    it('gET /success 应返回 { success: true, data: string }', async () => {
      const res = await fetch(`${baseUrl}/success`)
      const json = await res.json() as ApiResponse<string>

      expect(res.status).toBe(200)
      expect(json).toHaveProperty('success', true)
      expect(json).toHaveProperty('data')
      if (json.success) {
        expect(typeof json.data).toBe('string')
      }
    })

    it('gET /custom-code 应返回 { code: 0, data: string }', async () => {
      const res = await fetch(`${baseUrl}/custom-code`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      expect(json).toHaveProperty('code', 0)
      expect(json).toHaveProperty('data', 'custom code response')
      expect(json).toHaveProperty('msg', 'success')
    })
  })

  describe('业务错误端点', () => {
    it('gET /error/business/500 应返回 HTTP 200 但业务失败', async () => {
      const res = await fetch(`${baseUrl}/error/business/500`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      expect(json).toHaveProperty('success', false)
      expect(json).toHaveProperty('errorCode', 500)
      expect(json).toHaveProperty('errorMessage', '业务错误')
    })

    it('gET /custom-message 应返回自定义错误消息', async () => {
      const res = await fetch(`${baseUrl}/custom-message`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      expect(json).toHaveProperty('success', false)
      expect(json).toHaveProperty('msg', '自定义错误消息')
      expect(json).toHaveProperty('errorCode', 1001)
    })
  })

  describe('hTTP 错误端点', () => {
    it('gET /error/http/400 应返回 400 状态码', async () => {
      const res = await fetch(`${baseUrl}/error/http/400`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(400)
      expect(json).toHaveProperty('message', '请求参数错误')
    })

    it('gET /error/http/401 应返回 401 状态码', async () => {
      const res = await fetch(`${baseUrl}/error/http/401`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(401)
      expect(json).toHaveProperty('message', '未授权或登录已过期')
    })

    it('gET /error/http/403 应返回 403 状态码', async () => {
      const res = await fetch(`${baseUrl}/error/http/403`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(403)
      expect(json).toHaveProperty('message', '没有权限访问该资源')
    })

    it('gET /error/http/404 应返回 404 状态码', async () => {
      const res = await fetch(`${baseUrl}/error/http/404`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(404)
      expect(json).toHaveProperty('message', '请求的资源不存在')
    })

    it('gET /error/http/500 应返回 500 状态码', async () => {
      const res = await fetch(`${baseUrl}/error/http/500`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(500)
      expect(json).toHaveProperty('message', '服务器内部错误')
    })

    it('gET /error/http/418 应返回 418 状态码', async () => {
      const res = await fetch(`${baseUrl}/error/http/418`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(418)
      expect(json).toHaveProperty('message', 'I\'m a teapot')
    })
  })

  describe('echo 端点', () => {
    it('pOST /echo 应回显 method=POST 和请求体', async () => {
      const res = await fetch(`${baseUrl}/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      })
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(json.data.method).toBe('POST')
        expect(json.data.body).toEqual({ test: 'data' })
      }
    })

    it('pUT /echo 应回显 method=PUT', async () => {
      const res = await fetch(`${baseUrl}/echo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ update: 'value' }),
      })
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      if (json.success) {
        expect(json.data.method).toBe('PUT')
        expect(json.data.body).toEqual({ update: 'value' })
      }
    })

    it('pATCH /echo 应回显 method=PATCH', async () => {
      const res = await fetch(`${baseUrl}/echo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: 'field' }),
      })
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      if (json.success) {
        expect(json.data.method).toBe('PATCH')
        expect(json.data.body).toEqual({ patch: 'field' })
      }
    })

    it('dELETE /echo 应回显 method=DELETE', async () => {
      const res = await fetch(`${baseUrl}/echo`, { method: 'DELETE' })
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      if (json.success) {
        expect(json.data.method).toBe('DELETE')
      }
    })

    it('gET /echo 应回显 query 参数', async () => {
      const res = await fetch(`${baseUrl}/echo?foo=bar&num=123`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      if (json.success) {
        expect(json.data.method).toBe('GET')
        expect(json.data.query).toEqual({ foo: 'bar', num: '123' })
      }
    })
  })

  describe('params 端点', () => {
    it('gET /params 应回显 query 参数', async () => {
      const res = await fetch(`${baseUrl}/params?a=1&b=2&c=3`)
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(json.data.query).toEqual({ a: '1', b: '2', c: '3' })
      }
    })

    it('gET /params 应返回原始 query string', async () => {
      const res = await fetch(`${baseUrl}/params?ids=1,2,3`)
      const json = await res.json() as ApiResponse<EchoData>

      if (json.success) {
        expect(json.data.rawQuery).toBe('?ids=1,2,3')
      }
    })
  })

  describe('auth 端点', () => {
    it('gET /auth/check 应回显 Authorization header', async () => {
      const res = await fetch(`${baseUrl}/auth/check`, {
        headers: { Authorization: 'Bearer test-token' },
      })
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      if (json.success) {
        expect(json.data.authorization).toBe('Bearer test-token')
      }
    })

    it('gET /auth/check 无 Authorization 时应返回 null', async () => {
      const res = await fetch(`${baseUrl}/auth/check`)
      const json = await res.json() as ApiResponse<EchoData>

      if (json.success) {
        expect(json.data.authorization).toBeNull()
      }
    })
  })

  describe('headers 端点', () => {
    it('gET /headers/check 应回显所有 headers', async () => {
      const res = await fetch(`${baseUrl}/headers/check`, {
        headers: {
          'X-Custom-Header': 'custom-value',
          'Accept': 'application/json',
        },
      })
      const json = await res.json() as ApiResponse<EchoData>

      expect(res.status).toBe(200)
      if (json.success) {
        expect(json.data.headers?.['x-custom-header']).toBe('custom-value')
        expect(json.data.headers?.accept).toBe('application/json')
      }
    })
  })

  describe('formData 端点', () => {
    it('pOST /formdata 应正确解析 FormData', async () => {
      const formData = new FormData()
      formData.append('name', 'test')
      formData.append('value', '123')

      const res = await fetch(`${baseUrl}/formdata`, {
        method: 'POST',
        body: formData,
      })
      interface FormDataResult {
        isMultipart: boolean
        fields: Record<string, string>
      }
      const json = await res.json() as ApiResponse<FormDataResult>

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(json.data.isMultipart).toBe(true)
        expect(json.data.fields.name).toBe('test')
        expect(json.data.fields.value).toBe('123')
      }
    })
  })
})
