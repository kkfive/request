import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { startServer, stopServer } from './server'

declare global {
  // eslint-disable-next-line vars-on-top
  var __TEST_SERVER_URL__: string
}

beforeAll(async () => {
  const serverUrl = await startServer()
  globalThis.__TEST_SERVER_URL__ = serverUrl
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await stopServer()
})
