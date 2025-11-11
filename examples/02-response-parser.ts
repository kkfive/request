/* eslint-disable no-console */
/* eslint-disable ts/explicit-function-return-type */
/* eslint-disable unused-imports/no-unused-vars */
/**
 * 响应解析器示例
 *
 * 本示例展示了如何使用 responseParser 配置来自动解析和验证响应数据
 * 支持三种模式：raw（原始）、body（完整响应体）、data（提取数据字段）
 */

import type { RequestError } from '../src'
import { to } from '@esdora/kit'
import { Request } from '../src'

// 模拟的 API 基础 URL（实际使用时替换为真实 API）
const API_BASE_URL = 'http://127.0.0.1:4523/m1/3188536-1836903-default'

async function responseParserExamples() {
  console.log('=== 响应解析器示例 ===\n')

  // 示例 1: raw 模式 - 返回原始 Response 对象
  console.log('1. raw 模式示例:')
  const rawRequest = new Request({
    prefixUrl: API_BASE_URL,
    responseParser: {
      responseReturn: 'raw', // 返回原始 Response 对象
    },
  })

  const [rawError, rawResponse] = await to(rawRequest.get('/success'))
  if (rawError) {
    console.error('请求失败:', rawError.message)
  }
  else {
    console.log('原始响应:', {
      status: rawResponse.status,
      statusText: rawResponse.statusText,
      headers: Object.fromEntries(rawResponse.headers.entries()),
    })
    // 手动解析 JSON
    const data = await rawResponse.json()
    console.log('手动解析的数据:', data)
  }

  console.log('\n---\n')

  // 示例 2: body 模式 - 返回完整的响应体
  console.log('2. body 模式示例:')
  const bodyRequest = new Request({
    prefixUrl: API_BASE_URL,
    responseParser: {
      responseReturn: 'body', // 返回完整响应体
    },
  })

  const [bodyError, bodyData] = await to(bodyRequest.get('/success'))
  if (bodyError) {
    console.error('请求失败:', bodyError.message)
  }
  else {
    console.log('完整响应体:', bodyData)
    // 可以自行判断业务逻辑
    if (bodyData.success) {
      console.log('业务成功，数据:', bodyData.data)
    }
  }

  console.log('\n---\n')

  // 示例 3: data 模式 - 自动提取数据字段并验证业务状态
  console.log('3. data 模式示例（标准配置）:')
  const dataRequest = new Request({
    prefixUrl: API_BASE_URL,
    responseParser: {
      responseReturn: 'data', // 提取数据字段
      codeField: 'success', // 业务状态码字段名
      dataField: 'data', // 数据字段名
      successCode: code => code === true, // 成功判断逻辑
      errorCodeField: 'errorCode', // 错误码字段名
      errorMessageField: 'errorMessage', // 错误信息字段名
    },
  })

  const [dataError, data] = await to(dataRequest.get('/success'))
  if (dataError) {
    console.error('请求失败:', dataError.message)
  }
  else {
    console.log('提取的数据:', data)
  }

  console.log('\n---\n')

  // 示例 4: data 模式 - 使用数字状态码
  console.log('4. data 模式示例（数字状态码）:')
  const numericCodeRequest = new Request({
    prefixUrl: 'https://jsonplaceholder.typicode.com',
    responseParser: {
      responseReturn: 'data',
      codeField: 'code', // 假设响应格式为 { code: 0, data: {...} }
      dataField: 'data',
      successCode: 0, // code 为 0 表示成功
      errorMessageField: 'message',
    },
  })

  // 注意：jsonplaceholder.typicode.com 不返回标准格式，这里仅作演示
  console.log('（此示例需要真实的 API 支持标准格式）')

  console.log('\n---\n')

  // 示例 5: data 模式 - 使用函数提取数据
  console.log('5. data 模式示例（自定义数据提取）:')
  const customExtractRequest = new Request({
    prefixUrl: API_BASE_URL,
    responseParser: {
      responseReturn: 'data',
      codeField: 'success',
      // 使用函数自定义数据提取逻辑
      dataField: (res) => {
        // 可以进行复杂的数据转换
        return {
          ...res.data,
          extractedAt: new Date().toISOString(),
        }
      },
      successCode: code => code === true,
      // 使用函数自定义错误信息提取
      errorMessageField: (res) => {
        return `错误: ${res.errorMessage || res.message || '未知错误'}`
      },
    },
  })

  const [customError, customData] = await to(customExtractRequest.get('/success'))
  if (customError) {
    console.error('请求失败:', customError.message)
  }
  else {
    console.log('自定义提取的数据:', customData)
  }

  console.log('\n---\n')

  // 示例 6: 处理业务错误
  console.log('6. 处理业务错误示例:')
  const [businessError] = await to(dataRequest.get('/error/business/500'))
  if (businessError) {
    const error = businessError as RequestError
    console.log('业务错误信息:', {
      message: error.message,
      code: error.code,
      isBusinessError: error.isBusinessError,
      raw: error.raw,
    })
  }

  console.log('\n---\n')

  // 示例 7: 请求级别覆盖响应解析配置
  console.log('7. 请求级别覆盖配置示例:')
  // 全局配置是 data 模式，但这个请求使用 body 模式
  const [overrideError, overrideData] = await to(
    dataRequest.get('/success', {
      responseParser: {
        responseReturn: 'body', // 覆盖为 body 模式
      },
    }),
  )
  if (overrideError) {
    console.error('请求失败:', overrideError.message)
  }
  else {
    console.log('覆盖配置后的完整响应体:', overrideData)
  }
}

// 运行示例
responseParserExamples().catch(console.error)
