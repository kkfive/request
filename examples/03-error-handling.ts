/* eslint-disable no-console */
/* eslint-disable ts/explicit-function-return-type */
/* eslint-disable unused-imports/no-unused-vars */
/**
 * 错误处理示例
 *
 * 本示例展示了如何使用 RequestError 类的各种辅助方法来处理不同类型的错误
 */

import type { RequestError } from '../src'
import { to } from '@esdora/kit'
import { Request } from '../src'

// 创建一个配置了错误处理的 Request 实例
const request = new Request({
  prefixUrl: 'http://127.0.0.1:4523/m1/3188536-1836903-default',
  timeout: 5000,
  // 全局错误处理回调
  makeErrorMessage(message, error) {
    console.log(`[全局错误处理] ${message}`)
    console.log(`[错误详情] 类型: ${error.isBusinessError ? '业务错误' : '网络错误'}`)
  },
  responseParser: {
    responseReturn: 'data',
    codeField: 'success',
    dataField: 'data',
    successCode: code => code === true,
    errorCodeField: 'errorCode',
    errorMessageField: 'errorMessage',
  },
})

async function errorHandlingExamples() {
  console.log('=== 错误处理示例 ===\n')

  // 示例 1: 使用 RequestError 的辅助方法
  console.log('1. RequestError 辅助方法示例:')
  const [error1] = await to(request.get('/error/business/500'))
  if (error1) {
    const error = error1 as RequestError
    console.log('错误分析:')
    console.log('  - 是否是业务错误:', error.isBusinessError)
    console.log('  - 是否是网络错误:', error.isNetworkError())
    console.log('  - 是否是 HTTP 错误:', error.isHttpError())
    console.log('  - 是否是 4xx 错误:', error.is4xxError())
    console.log('  - 是否是 5xx 错误:', error.is5xxError())
    console.log('  - 是否是超时错误:', error.isTimeout())
    console.log('  - 格式化输出:', error.toString())
    console.log('  - JSON 格式:', JSON.stringify(error.toJSON(), null, 2))
  }

  console.log('\n---\n')

  // 示例 2: 区分业务错误和网络错误
  console.log('2. 区分错误类型示例:')

  // 业务错误（HTTP 200 但业务 code 不匹配）
  const [businessError] = await to(request.get('/error/business/500'))
  if (businessError) {
    const error = businessError as RequestError
    if (error.isBusinessError) {
      console.log('这是业务错误:')
      console.log('  - 错误码:', error.code)
      console.log('  - 错误信息:', error.message)
      console.log('  - 原始响应:', error.raw)
    }
  }

  console.log('')

  // 网络错误（HTTP 4xx/5xx）
  const [networkError] = await to(request.get('/error/http/500'))
  if (networkError) {
    const error = networkError as RequestError
    if (error.isNetworkError()) {
      console.log('这是网络错误:')
      console.log('  - HTTP 状态码:', error.code)
      console.log('  - 错误信息:', error.message)
      console.log('  - 响应状态:', error.response?.status, error.response?.statusText)
    }
  }

  console.log('\n---\n')

  // 示例 3: 根据错误类型采取不同的处理策略
  console.log('3. 错误处理策略示例:')

  async function handleRequest(url: string) {
    const [error, data] = await to(request.get(url))

    if (error) {
      const err = error as RequestError

      // 根据错误类型采取不同的处理策略
      if (err.isBusinessError) {
        // 业务错误：显示错误提示给用户
        console.log(`[业务错误] ${err.message}`)
        console.log('  处理策略: 显示错误提示给用户')
      }
      else if (err.is4xxError()) {
        // 4xx 客户端错误
        if (err.isHttpError(401)) {
          console.log('[401 未授权] 需要重新登录')
          console.log('  处理策略: 跳转到登录页')
        }
        else if (err.isHttpError(403)) {
          console.log('[403 禁止访问] 没有权限')
          console.log('  处理策略: 显示权限不足提示')
        }
        else if (err.isHttpError(404)) {
          console.log('[404 未找到] 资源不存在')
          console.log('  处理策略: 显示资源不存在提示')
        }
        else {
          console.log(`[4xx 错误] ${err.message}`)
          console.log('  处理策略: 显示通用客户端错误提示')
        }
      }
      else if (err.is5xxError()) {
        // 5xx 服务器错误
        console.log(`[5xx 服务器错误] ${err.message}`)
        console.log('  处理策略: 显示服务器错误提示，建议稍后重试')
      }
      else if (err.isTimeout()) {
        // 超时错误
        console.log('[超时错误] 请求超时')
        console.log('  处理策略: 提示用户网络不稳定，建议重试')
      }
      else {
        // 其他错误
        console.log(`[未知错误] ${err.message}`)
        console.log('  处理策略: 显示通用错误提示')
      }

      return null
    }

    return data
  }

  await handleRequest('/error/business/500')
  console.log('')
  await handleRequest('/error/http/500')

  console.log('\n---\n')

  // 示例 4: 自定义错误处理回调
  console.log('4. 自定义错误处理回调示例:')

  // 请求级别的错误处理回调会覆盖全局回调
  const [error4] = await to(
    request.get('/error/business/500', {
      makeErrorMessage(message, error) {
        console.log('[请求级错误处理] 这个回调会覆盖全局回调')
        console.log(`  错误信息: ${message}`)
        console.log(`  错误类型: ${error.isBusinessError ? '业务错误' : '网络错误'}`)

        // 可以在这里执行副作用，比如：
        // - 显示 Toast 提示
        // - 记录错误日志
        // - 上报错误到监控系统
      },
    }),
  )

  console.log('\n---\n')

  // 示例 5: 错误重试策略
  console.log('5. 错误重试策略示例:')

  async function requestWithRetry(url: string, maxRetries = 3) {
    let lastError: RequestError | null = null

    for (let i = 0; i < maxRetries; i++) {
      console.log(`尝试第 ${i + 1} 次请求...`)

      const [error, data] = await to(request.get(url))

      if (!error) {
        console.log('请求成功!')
        return data
      }

      lastError = error as RequestError

      // 只对网络错误和超时错误进行重试
      if (lastError.isNetworkError() || lastError.isTimeout()) {
        console.log(`  失败: ${lastError.message}`)

        if (i < maxRetries - 1) {
          const delay = 2 ** i * 1000 // 指数退避
          console.log(`  等待 ${delay}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      else {
        // 业务错误不重试
        console.log(`  业务错误，不进行重试: ${lastError.message}`)
        break
      }
    }

    console.log('所有重试都失败了')
    throw lastError
  }

  try {
    await requestWithRetry('/error/http/500', 2)
  }
  catch (error) {
    console.log('最终失败:', (error as RequestError).message)
  }
}

// 运行示例
errorHandlingExamples().catch(console.error)
