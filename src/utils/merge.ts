import { isPlainObject, isUnsafeProperty } from './predicates'
/**
 * Merges the properties of the source object into the target object.
 *
 * This function performs a deep merge, meaning nested objects and arrays are merged recursively.
 * If a property in the source object is an array or an object and the corresponding property in the target object is also an array or object, they will be merged.
 * If a property in the source object is undefined, it will not overwrite a defined property in the target object.
 *
 * Note that this function mutates the target object.
 *
 * @param {T} target - The target object into which the source object properties will be merged. This object is modified in place.
 * @param {S} source - The source object whose properties will be merged into the target object.
 * @returns {T & S} The updated target object with properties from the source object merged in.
 *
 * @template T - Type of the target object.
 * @template S - Type of the source object.
 *
 * @example
 * const target = { a: 1, b: { x: 1, y: 2 } };
 * const source = { b: { y: 3, z: 4 }, c: 5 };
 *
 * const result = merge(target, source);
 * console.log(result);
 * // Output: { a: 1, b: { x: 1, y: 3, z: 4 }, c: 5 }
 *
 * @example
 * const target = { a: [1, 2], b: { x: 1 } };
 * const source = { a: [3], b: { y: 2 } };
 *
 * const result = merge(target, source);
 * console.log(result);
 * // Output: { a: [3, 2], b: { x: 1, y: 2 } }
 *
 * @example
 * const target = { a: null };
 * const source = { a: [1, 2, 3] };
 *
 * const result = merge(target, source);
 * console.log(result);
 * // Output: { a: [1, 2, 3] }
 */
export function merge<T extends Record<PropertyKey, any>, S extends Record<PropertyKey, any>>(
  target: T,
  source: S,
): T & S {
  const sourceKeys = Object.keys(source) as Array<keyof S>

  for (let i = 0; i < sourceKeys.length; i++) {
    const key = sourceKeys[i]

    if (isUnsafeProperty(key)) {
      continue
    }

    const sourceValue = source[key]
    const targetValue = target[key]

    if (Array.isArray(sourceValue)) {
      const sourceClone = cloneArray(sourceValue)
      if (Array.isArray(targetValue)) {
        target[key] = [...cloneArray(targetValue), ...sourceClone] as any
      }
      else {
        target[key] = sourceClone as any
      }
    }
    else if (isPlainObject(sourceValue)) {
      if (isPlainObject(targetValue)) {
        target[key] = merge(targetValue, sourceValue)
      }
      else {
        target[key] = merge({}, sourceValue)
      }
    }
    else if (sourceValue !== undefined) {
      target[key] = sourceValue as any
    }
  }

  return target
}

function cloneArray(value: any[]): any[] {
  return value.map((item) => {
    if (Array.isArray(item)) {
      return cloneArray(item)
    }
    if (isPlainObject(item)) {
      return merge({}, item)
    }
    return item
  })
}
