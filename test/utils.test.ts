import { describe, expect, it } from 'vitest'
import { to } from '../src'
import { isFunction, isPlainObject, isUnsafeProperty, merge } from '../src/utils'

describe('to 工具函数', () => {
  it('promise 成功时应返回 [null, data]', async () => {
    const promise = Promise.resolve('success')
    const [error, data] = await to(promise)

    expect(error).toBeNull()
    expect(data).toBe('success')
  })

  it('promise 失败时应返回 [error, undefined]', async () => {
    const promise = Promise.reject(new Error('failed'))
    const [error, data] = await to(promise)

    expect(error).toBeInstanceOf(Error)
    expect(error?.message).toBe('failed')
    expect(data).toBeUndefined()
  })

  it('带 errorExt 时应合并到 error 对象', async () => {
    const promise = Promise.reject(new Error('failed'))
    const [error] = await to(promise, { code: 500, extra: 'info' })

    // Object.assign({}, err, errorExt) 会丢失原型链，但保留可枚举属性
    expect(error).toHaveProperty('code', 500)
    expect(error).toHaveProperty('extra', 'info')
  })

  it('errorExt 为空对象时应正常工作', async () => {
    const promise = Promise.reject(new Error('failed'))
    const [error] = await to(promise, {})

    // 空对象合并后仍然丢失原型链
    expect(error).toBeDefined()
  })
})

describe('merge 工具函数', () => {
  it('应合并简单对象', () => {
    const target = { a: 1 }
    const source = { b: 2 }
    const result = merge(target, source)

    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('应深度合并嵌套对象', () => {
    const target = { a: 1, b: { x: 1, y: 2 } }
    const source = { b: { y: 3, z: 4 }, c: 5 }
    const result = merge(target, source)

    expect(result).toEqual({ a: 1, b: { x: 1, y: 3, z: 4 }, c: 5 })
  })

  it('应合并数组', () => {
    const target = { a: [1, 2] }
    const source = { a: [3] }
    const result = merge(target, source)

    expect(result.a).toEqual([3, 2])
  })

  it('source 为数组但 target 不是时应创建新数组', () => {
    const target = { a: null } as any
    const source = { a: [1, 2, 3] }
    const result = merge(target, source)

    expect(result.a).toEqual([1, 2, 3])
  })

  it('source 为对象但 target 不是时应创建新对象', () => {
    const target = { a: null } as any
    const source = { a: { x: 1 } }
    const result = merge(target, source)

    expect(result.a).toEqual({ x: 1 })
  })

  it('应忽略 __proto__ 属性防止原型污染', () => {
    const target = {}
    const source = JSON.parse('{"__proto__": {"polluted": true}}')
    const result = merge(target, source)

    expect(({} as any).polluted).toBeUndefined()
    expect(result).not.toHaveProperty('__proto__')
  })

  it('source 值为 undefined 时不应覆盖 target', () => {
    const target = { a: 1 }
    const source = { a: undefined } as { a: number | undefined }
    const result = merge(target, source)

    expect(result.a).toBe(1)
  })

  it('target 值为 undefined 时应被 source 覆盖', () => {
    const target = { a: undefined } as any
    const source = { a: 1 }
    const result = merge(target, source)

    expect(result.a).toBe(1)
  })
})

describe('isPlainObject 工具函数', () => {
  it('空对象应返回 true', () => {
    expect(isPlainObject({})).toBe(true)
  })

  it('带属性的对象应返回 true', () => {
    expect(isPlainObject({ key: 'value' })).toBe(true)
  })

  it('new Object() 应返回 true', () => {
    expect(isPlainObject(new Object())).toBe(true)
  })

  it('object.create(null) 应返回 true', () => {
    expect(isPlainObject(Object.create(null))).toBe(true)
  })

  it('数组应返回 false', () => {
    expect(isPlainObject([])).toBe(false)
  })

  it('null 应返回 false', () => {
    expect(isPlainObject(null)).toBe(false)
  })

  it('undefined 应返回 false', () => {
    expect(isPlainObject(undefined)).toBe(false)
  })

  it('数字应返回 false', () => {
    expect(isPlainObject(10)).toBe(false)
  })

  it('字符串应返回 false', () => {
    expect(isPlainObject('hello')).toBe(false)
  })

  it('date 实例应返回 false', () => {
    expect(isPlainObject(new Date())).toBe(false)
  })

  it('类实例应返回 false', () => {
    class Test {}
    expect(isPlainObject(new Test())).toBe(false)
  })

  it('promise 应返回 false', () => {
    expect(isPlainObject(Promise.resolve({}))).toBe(false)
  })

  it('object.create({}) 应返回 false', () => {
    expect(isPlainObject(Object.create({}))).toBe(false)
  })
})

describe('isUnsafeProperty 工具函数', () => {
  it('__proto__ 应返回 true', () => {
    expect(isUnsafeProperty('__proto__')).toBe(true)
  })

  it('普通属性名应返回 false', () => {
    expect(isUnsafeProperty('name')).toBe(false)
    expect(isUnsafeProperty('constructor')).toBe(false)
    expect(isUnsafeProperty('prototype')).toBe(false)
  })

  it('symbol 应返回 false', () => {
    expect(isUnsafeProperty(Symbol('test'))).toBe(false)
  })

  it('数字键应返回 false', () => {
    expect(isUnsafeProperty(0)).toBe(false)
    expect(isUnsafeProperty(1)).toBe(false)
  })
})

describe('isFunction 工具函数', () => {
  it('普通函数应返回 true', () => {
    expect(isFunction(() => {})).toBe(true)
    // eslint-disable-next-line prefer-arrow-callback
    expect(isFunction(function () {})).toBe(true)
  })

  it('async 函数应返回 true', () => {
    expect(isFunction(async () => {})).toBe(true)
  })

  it('generator 函数应返回 true', () => {
    expect(isFunction(function* () {})).toBe(true)
  })

  it('内置函数应返回 true', () => {
    expect(isFunction(Array.prototype.slice)).toBe(true)
    expect(isFunction(Object.keys)).toBe(true)
  })

  it('类应返回 true', () => {
    class Test {}
    expect(isFunction(Test)).toBe(true)
  })

  it('对象应返回 false', () => {
    expect(isFunction({})).toBe(false)
  })

  it('数组应返回 false', () => {
    expect(isFunction([])).toBe(false)
  })

  it('null 应返回 false', () => {
    expect(isFunction(null)).toBe(false)
  })

  it('undefined 应返回 false', () => {
    expect(isFunction(undefined)).toBe(false)
  })

  it('字符串应返回 false', () => {
    expect(isFunction('function')).toBe(false)
  })

  it('数字应返回 false', () => {
    expect(isFunction(123)).toBe(false)
  })
})
