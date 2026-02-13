/* eslint-disable no-console */
/* eslint-disable node/prefer-global/process */
/**
 * 综合示例 - 演示完整的请求流程
 *
 * 本示例展示了如何配置一个完整的 Request 实例，包括：
 * - 响应解析器配置
 * - 错误处理回调
 * - Hooks 使用
 * - 不同场景的请求处理
 *
 * 注意：此示例使用的是 Apifox Mock API，需要先启动 Mock 服务
 * API 文档: https://zet8c558g2.apifox.cn/
 */

import type { RequestError } from '../src'
import { to } from '@esdora/kit'
import { Request } from '../src'

// 创建一个配置完整的 Request 实例
const request = new Request({
  // API 基础 URL
  prefixUrl: 'http://127.0.0.1:4523/m1/3188536-1836903-default',

  // 全局错误处理回调
  // 当请求发生错误时，会自动调用此函数
  makeErrorMessage(message) {
    console.error(`「全局错误处理」=> ${message}`)
  },

  // 响应解析器配置
  responseParser: {
    // 返回模式：data - 自动提取数据字段并验证业务状态
    responseReturn: 'data',
    // 数据字段名：从响应体中提取 data 字段
    dataField: 'data',
    // 业务状态码字段名：使用 success 字段判断业务是否成功
    codeField: 'success',
    // 错误信息字段名：当业务失败时，从 errorMessage 字段获取错误信息
    errorMessageField: 'errorMessage',
    // 错误码字段名：当业务失败时，从 errorCode 字段获取错误码
    errorCodeField: 'errorCode',
    // 成功判断逻辑：success 字段为 true 时表示业务成功
    successCode: code => code === true,
  },

  // Hooks 配置
  hooks: {
    // afterResponse hook：在收到响应后执行
    afterResponse: [
      (request, options, response) => {
        console.log(`「afterResponse Hook」=> 收到响应，状态码: ${response.status}`)
        // 必须返回 response 以便后续处理
        return response
      },
    ],
  },
})

/**
 * 基础请求函数
 * 封装了通用的请求逻辑和错误处理
 *
 * @param name - 请求名称，用于日志输出
 * @param url - 请求 URL
 * @returns 请求结果或 undefined（发生错误时）
 */
async function baseRequest(name: string, url: string): Promise<any> {
  // 使用 to 函数包装请求，自动处理错误
  const [error, result] = await to(request.get(url))

  if (error) {
    // 请求失败，输出错误信息
    const _error = error as RequestError
    console.error(
      `「${name} 请求失败」=>`,
      `错误类型: ${_error.name}`,
      `错误码: ${_error.code}`,
      `错误信息: ${_error.message}`,
      `原始响应:`,
      _error.raw,
    )
    return
  }

  // 请求成功，输出结果
  console.log(`「${name} 请求成功」=> 结果:`, result)
  return result
}

/**
 * 成功请求示例
 * 演示正常的请求流程
 */
async function success(url = '/success'): Promise<any> {
  console.log('\n=== 成功请求示例 ===')
  return baseRequest('成功请求', url)
}

/**
 * 业务错误示例
 * 演示 HTTP 状态码为 200，但业务状态码表示失败的情况
 */
async function errorBusiness(url = '/error/business/500'): Promise<any> {
  console.log('\n=== 业务错误示例 ===')
  console.log('说明: HTTP 200，但 success 字段为 false')
  return baseRequest('业务错误', url)
}

/**
 * 网络错误示例
 * 演示 HTTP 状态码为 4xx/5xx 的情况
 */
async function errorNetwork(url = '/error/http/500'): Promise<any> {
  console.log('\n=== 网络错误示例 ===')
  console.log('说明: HTTP 500 服务器错误')
  return baseRequest('网络错误', url)
}

/**
 * 主函数
 * 依次执行各种场景的请求示例
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════╗')
  console.log('║   @kkfive/request 综合示例            ║')
  console.log('╚════════════════════════════════════════╝')

  // 1. 成功请求
  await success()
  console.log(`\n${'─'.repeat(50)}`)

  // 2. 业务错误
  await errorBusiness()
  console.log(`\n${'─'.repeat(50)}`)

  // 3. 网络错误
  await errorNetwork()
  console.log(`\n${'─'.repeat(50)}`)

  // 4. 另一个网络错误示例
  await errorNetwork('/error/http/500-empty')

  console.log('\n╔════════════════════════════════════════╗')
  console.log('║   示例执行完成                         ║')
  console.log('╚════════════════════════════════════════╝')
}

// 运行主函数
main().catch((error) => {
  console.error('示例执行失败:', error)
  process.exit(1)
})
