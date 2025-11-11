/**
 * Vitest setup file
 * 用于配置全局的测试环境
 */

import process from 'node:process'
import { afterAll, beforeAll } from 'vitest'
import { mockServer } from './mocks/server'

let mockServerUrl = ''

beforeAll(async () => {
  // 启动 mock HTTP 服务器(使用动态端口)
  mockServerUrl = await mockServer.start(0)
  // 设置环境变量供测试使用
  process.env.MOCK_SERVER_URL = mockServerUrl
})

afterAll(async () => {
  // 关闭 mock HTTP 服务器
  await mockServer.stop()
})
