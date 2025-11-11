/* eslint-disable no-console */
/* eslint-disable ts/explicit-function-return-type */
/* eslint-disable unused-imports/no-unused-vars */
/**
 * 高级特性示例
 *
 * 本示例展示了 Request 类的高级特性，包括：
 * - 实例扩展（extend）
 * - 静态创建方法（create）
 * - Hooks 使用
 * - 请求配置
 */

import { to } from '@esdora/kit'
import { Request } from '../src'

async function advancedFeaturesExamples() {
  console.log('=== 高级特性示例 ===\n')

  // 示例 1: 使用静态方法创建实例
  console.log('1. 使用静态方法创建实例:')
  const baseRequest = Request.create({
    prefixUrl: 'https://jsonplaceholder.typicode.com',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const [error1, data1] = await to(baseRequest.get('/users/1'))
  if (!error1) {
    console.log('用户信息:', data1)
  }

  console.log('\n---\n')

  // 示例 2: 使用 extend 创建派生实例
  console.log('2. 使用 extend 创建派生实例:')

  // 创建一个带认证的派生实例
  const authRequest = baseRequest.extend({
    headers: {
      'Authorization': 'Bearer fake-token-123',
      'X-Custom-Header': 'custom-value',
    },
  })

  console.log('派生实例会继承基础实例的配置，并添加新的配置')

  // 创建另一个派生实例，用于特定的 API
  const apiV2Request = baseRequest.extend({
    prefixUrl: 'https://jsonplaceholder.typicode.com',
    headers: {
      'API-Version': 'v2',
    },
  })

  console.log('可以创建多个派生实例，互不影响')

  console.log('\n---\n')

  // 示例 3: 使用 Hooks
  console.log('3. 使用 Hooks 示例:')

  const requestWithHooks = Request.create({
    prefixUrl: 'https://jsonplaceholder.typicode.com',
    hooks: {
      // beforeRequest hook: 在请求发送前执行
      beforeRequest: [
        (request, options) => {
          console.log('[beforeRequest] 请求即将发送:', {
            url: request.url,
            method: request.method,
          })
        },
      ],
      // afterResponse hook: 在收到响应后执行
      afterResponse: [
        (request, options, response) => {
          console.log('[afterResponse] 收到响应:', {
            url: request.url,
            status: response.status,
          })
          // 必须返回 response 以便后续处理
          return response
        },
      ],
    },
  })

  const [error3] = await to(requestWithHooks.get('/users/1'))
  if (error3) {
    console.error('请求失败:', error3.message)
  }

  console.log('\n---\n')

  // 示例 4: 请求级别的 Hooks
  console.log('4. 请求级别的 Hooks 示例:')

  const [error4] = await to(
    baseRequest.get('/users/1', {
      hooks: {
        afterResponse: [
          (request, options, response) => {
            console.log('[请求级 Hook] 这个 Hook 只对当前请求生效')
            return response
          },
        ],
      },
    }),
  )

  console.log('\n---\n')

  // 示例 5: 参数序列化
  console.log('5. 参数序列化示例:')

  const requestWithParams = Request.create({
    prefixUrl: 'https://jsonplaceholder.typicode.com',
  })

  // 默认序列化方式（repeat）
  console.log('默认序列化（repeat）:')
  await to(
    requestWithParams.get('/posts', {
      params: {
        userId: [1, 2, 3],
        status: 'published',
      },
    }),
  )
  console.log('  URL: /posts?userId=1&userId=2&userId=3&status=published')

  // brackets 序列化
  console.log('\nbrackets 序列化:')
  await to(
    requestWithParams.get('/posts', {
      params: {
        userId: [1, 2, 3],
      },
      paramsSerializer: 'brackets',
    }),
  )
  console.log('  URL: /posts?userId[]=1&userId[]=2&userId[]=3')

  // comma 序列化
  console.log('\ncomma 序列化:')
  await to(
    requestWithParams.get('/posts', {
      params: {
        userId: [1, 2, 3],
      },
      paramsSerializer: 'comma',
    }),
  )
  console.log('  URL: /posts?userId=1,2,3')

  // indices 序列化
  console.log('\nindices 序列化:')
  await to(
    requestWithParams.get('/posts', {
      params: {
        userId: [1, 2, 3],
      },
      paramsSerializer: 'indices',
    }),
  )
  console.log('  URL: /posts?userId[0]=1&userId[1]=2&userId[2]=3')

  console.log('\n---\n')

  // 示例 6: 超时配置
  console.log('6. 超时配置示例:')

  const requestWithTimeout = Request.create({
    prefixUrl: 'https://jsonplaceholder.typicode.com',
    timeout: 1000, // 全局超时 1 秒
  })

  // 请求级别覆盖超时配置
  const [timeoutError] = await to(
    requestWithTimeout.get('/users/1', {
      timeout: 5000, // 这个请求超时 5 秒
    }),
  )

  if (timeoutError) {
    console.log('请求超时:', timeoutError.message)
  }
  else {
    console.log('请求成功（在 5 秒内完成）')
  }

  console.log('\n---\n')

  // 示例 7: 组合使用多个特性
  console.log('7. 组合使用多个特性:')

  // 创建一个功能完整的请求实例
  const fullFeaturedRequest = Request.create({
    prefixUrl: 'https://jsonplaceholder.typicode.com',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
    hooks: {
      beforeRequest: [
        (request) => {
          // 添加时间戳
          const url = new URL(request.url)
          url.searchParams.set('_t', Date.now().toString())
          return new globalThis.Request(url.toString(), request)
        },
      ],
      afterResponse: [
        (request, options, response) => {
          // 记录响应时间
          console.log(`[性能] ${request.url} 响应时间: ${response.headers.get('x-response-time') || 'N/A'}`)
          return response
        },
      ],
    },
  })

  // 创建认证派生实例
  const authenticatedRequest = fullFeaturedRequest.extend({
    headers: {
      Authorization: 'Bearer token-123',
    },
  })

  // 创建管理员派生实例
  const adminRequest = authenticatedRequest.extend({
    headers: {
      'X-Admin-Token': 'admin-secret',
    },
  })

  console.log('创建了三层实例:')
  console.log('  1. 基础实例（fullFeaturedRequest）')
  console.log('  2. 认证实例（authenticatedRequest）')
  console.log('  3. 管理员实例（adminRequest）')
  console.log('每一层都继承上一层的配置，并添加新的配置')

  const [error7] = await to(adminRequest.get('/users/1'))
  if (error7) {
    console.error('请求失败:', error7.message)
  }
}

// 运行示例
advancedFeaturesExamples().catch(console.error)
