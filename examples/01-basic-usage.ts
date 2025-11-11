/* eslint-disable no-console */
/* eslint-disable ts/explicit-function-return-type */
/**
 * 基础使用示例
 *
 * 本示例展示了如何创建和使用 Request 实例进行基本的 HTTP 请求
 */

import { to } from '@esdora/kit'
import { Request } from '../src'

// 创建一个基础的 Request 实例
const request = new Request({
  // 设置基础 URL，所有请求都会以此为前缀
  prefixUrl: 'https://jsonplaceholder.typicode.com',
  // 设置超时时间（毫秒）
  timeout: 10000,
})

async function basicUsage() {
  console.log('=== 基础使用示例 ===\n')

  // 示例 1: GET 请求
  console.log('1. GET 请求示例:')
  const [getUserError, user] = await to(request.get('/users/1'))
  if (getUserError) {
    console.error('获取用户失败:', getUserError.message)
  }
  else {
    console.log('用户信息:', user)
  }

  console.log('\n---\n')

  // 示例 2: POST 请求
  console.log('2. POST 请求示例:')
  const [postError, newPost] = await to(
    request.post('/posts', {
      title: '测试文章',
      body: '这是文章内容',
      userId: 1,
    }),
  )
  if (postError) {
    console.error('创建文章失败:', postError.message)
  }
  else {
    console.log('创建的文章:', newPost)
  }

  console.log('\n---\n')

  // 示例 3: PUT 请求
  console.log('3. PUT 请求示例:')
  const [putError, updatedPost] = await to(
    request.put('/posts/1', {
      id: 1,
      title: '更新后的文章标题',
      body: '更新后的文章内容',
      userId: 1,
    }),
  )
  if (putError) {
    console.error('更新文章失败:', putError.message)
  }
  else {
    console.log('更新后的文章:', updatedPost)
  }

  console.log('\n---\n')

  // 示例 4: PATCH 请求
  console.log('4. PATCH 请求示例:')
  const [patchError, patchedPost] = await to(
    request.patch('/posts/1', {
      title: '部分更新的标题',
    }),
  )
  if (patchError) {
    console.error('部分更新失败:', patchError.message)
  }
  else {
    console.log('部分更新后的文章:', patchedPost)
  }

  console.log('\n---\n')

  // 示例 5: DELETE 请求
  console.log('5. DELETE 请求示例:')
  const [deleteError] = await to(request.delete('/posts/1'))
  if (deleteError) {
    console.error('删除文章失败:', deleteError.message)
  }
  else {
    console.log('文章删除成功')
  }

  console.log('\n---\n')

  // 示例 6: HEAD 请求（获取资源元信息）
  console.log('6. HEAD 请求示例:')
  const [headError, headResponse] = await to(request.head('/posts/1'))
  if (headError) {
    console.error('HEAD 请求失败:', headError.message)
  }
  else {
    console.log('响应头信息:', {
      status: headResponse.status,
      contentType: headResponse.headers.get('content-type'),
      contentLength: headResponse.headers.get('content-length'),
    })
  }

  console.log('\n---\n')

  // 示例 7: OPTIONS 请求（获取支持的方法）
  console.log('7. OPTIONS 请求示例:')
  const [optionsError, optionsResponse] = await to(request.options('/posts'))
  if (optionsError) {
    console.error('OPTIONS 请求失败:', optionsError.message)
  }
  else {
    console.log('支持的方法:', {
      status: optionsResponse.status,
      allow: optionsResponse.headers.get('allow'),
    })
  }
}

// 运行示例
basicUsage().catch(console.error)
