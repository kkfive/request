/**
 * kk-request 可运行示例入口。
 * 运行：pnpm start:example
 *
 * 只执行无需专用后端的示例；其他文件是配置演示，按主题单独阅读。
 */
import process from 'node:process'
import { authWithRefresh } from './auth-refresh'
import { basicUsage } from './basic'
import { errorHandling } from './error-handling'
import { responseModes } from './response-modes'
import { schemaValidation } from './schema-validation'
import { sseExamples } from './sse'

async function main(): Promise<void> {
  await basicUsage()
  await errorHandling()

  responseModes()
  authWithRefresh()
  sseExamples()
  schemaValidation()

  console.log('[examples] all done')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
