import { describe, expect, it } from 'vitest'
import { Request, RequestError } from '../src'

describe('exports', () => {
  it('should export Request class', () => {
    expect(Request).toBeDefined()
    expect(typeof Request).toBe('function')
  })

  it('should export RequestError class', () => {
    expect(RequestError).toBeDefined()
    expect(typeof RequestError).toBe('function')
  })
})
