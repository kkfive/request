import { describe, expect, it } from 'vitest'
import { BusinessError, HTTPError, isHTTPError, Request } from '../src'

describe('exports', () => {
  it('should export Request class', () => {
    expect(Request).toBeDefined()
    expect(typeof Request).toBe('function')
  })

  it('should export BusinessError class', () => {
    expect(BusinessError).toBeDefined()
    expect(typeof BusinessError).toBe('function')
  })

  it('should re-export ky transport error types and guards', () => {
    expect(HTTPError).toBeDefined()
    expect(typeof isHTTPError).toBe('function')
  })
})
