/**
 * Checks if `value` is a function.
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

/**
 * Checks if a given value is a plain object.
 */
export function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (!value || typeof value !== 'object') {
    return false
  }

  const proto = Object.getPrototypeOf(value) as typeof Object.prototype | null

  const hasObjectPrototype
    = proto === null
      || proto === Object.prototype
      || Object.getPrototypeOf(proto) === null

  if (!hasObjectPrototype) {
    return false
  }

  return Object.prototype.toString.call(value) === '[object Object]'
}

/**
 * Checks if a property key is unsafe to modify directly.
 * @internal
 */
export function isUnsafeProperty(key: PropertyKey): boolean {
  return key === '__proto__'
}
