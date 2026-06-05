import { beforeAll, describe, expect, it } from 'vitest'
import { Request } from '../../../src'

import { getBaseUrl } from '../helpers'

describe('request 基础能力', () => {
  let baseUrl: string

  beforeAll(() => {
    baseUrl = getBaseUrl()
  })

  describe('静态方法和属性', () => {
    it('createAbortController 应返回 AbortController 实例', () => {
      const controller = Request.createAbortController()
      expect(controller).toBeInstanceOf(AbortController)
      expect(typeof controller.abort).toBe('function')
      expect(controller.signal).toBeInstanceOf(AbortSignal)
    })

    it('raw getter 应返回 ky 实例', () => {
      const request = new Request({ prefix: baseUrl })
      expect(request.raw).toBeDefined()
      expect(typeof request.raw).toBe('function')
    })
  })
})
