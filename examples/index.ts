/**
 * kk-request 用法示例 —— 用法代码的唯一真源（SSOT）。
 * 运行：pnpm start:example
 *
 * 说明：
 * - 基础 GET/POST 指向公共 API（jsonplaceholder），可直接跑通；
 * - token 刷新 / 响应模式 / SSE 需对应后端，仅作「配置演示」（构造 client，不实际发请求）；
 * - 为在 Node 下可运行，token 存取用内存对象模拟；浏览器中可换成 localStorage。
 */
import type { StandardSchemaV1 } from '@kkfive/request'
import process from 'node:process'
import {
  BusinessError,
  createClient,
  createSSEStream,
  isHTTPError,
  isNetworkError,
  isTimeoutError,
  SchemaValidationError,
} from '@kkfive/request'

// ── 1. 最简用法（可直接跑通：公共 API，无需 token）──
const http = createClient({ prefix: 'https://jsonplaceholder.typicode.com' })

async function basicUsage(): Promise<void> {
  const users = await http.get<Array<{ id: number, name: string }>>('/users')
  console.log('[basic] users:', users.length)

  const created = await http.post<{ id: number }>('/posts', { title: 'kk', body: 'hi', userId: 1 })
  console.log('[basic] created id:', created.id)
}

// ── 2. 三种响应模式（配置演示）──
function responseModes(): void {
  // raw：返回原始 Response 对象
  createClient({ responseParser: { responseReturn: 'raw' } })
  // body：返回完整响应体 { code, data, message }
  createClient({ responseParser: { responseReturn: 'body' } })
  // data：仅返回 data 字段（需后端返回 { code, data } 结构，并校验业务码）
  createClient({
    responseParser: { responseReturn: 'data', codeField: 'code', dataField: 'data', successCode: 0 },
  })
}

// ── 3. token 注入 + 401 自动刷新（配置演示）──
// 内存模拟 token 存储；浏览器中可换成 localStorage。
const store = { access: 'initial-token', refresh: 'refresh-token' }

function authWithRefresh(): ReturnType<typeof createClient> {
  return createClient({
    prefix: 'https://api.example.com',
    auth: {
      getToken: () => store.access, // headerName 默认 'Authorization'，scheme 默认 'Bearer'
      refreshToken: {
        getRefreshToken: () => store.refresh,
        refresh: async (refreshToken) => {
          // 调用刷新接口，返回新的 access token
          const res = await fetch('https://api.example.com/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          })
          return (await res.json() as { accessToken: string }).accessToken
        },
        onRefreshSuccess: (newToken) => {
          store.access = newToken // 持久化，后续请求才能拿到新 token
        },
        onRefreshFail: () => {
          // 跳转登录页等
        },
      },
    },
    onUnauthorized: () => {
      // 刷新失败 / 无 refreshToken 时的 401 兜底
    },
  })
}

// ── 4. 错误处理：BusinessError vs 传输层错误 ──
async function errorHandling(): Promise<void> {
  try {
    await http.get('/posts/0') // 不存在 → 404 HTTPError
  }
  catch (error) {
    if (error instanceof BusinessError)
      console.log('[error] 业务错误', error.code, error.raw) // HTTP 2xx 但业务 code 不符
    else if (isHTTPError(error))
      console.log('[error] HTTP 错误', error.response.status) // 4xx / 5xx
    else if (isTimeoutError(error))
      console.log('[error] 超时')
    else if (isNetworkError(error))
      console.log('[error] 网络错误')
    else
      console.log('[error] 未知错误', error)
  }
}

// ── 5. SSE 流式：两种消费模式（配置演示）──
interface ChatChunk { choices?: Array<{ delta?: { content?: string } }> }

function sseExamples(): { iterate: () => Promise<void>, emit: () => void } {
  const ai = createClient({ prefix: 'https://api.openai.com/v1', auth: { getToken: () => 'sk-xxx' } })

  // 模式一：async iteration
  async function iterate(): Promise<void> {
    const stream = createSSEStream<ChatChunk>(ai.raw, '/chat/completions', {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
    })
    for await (const event of stream) {
      const delta = event.data?.choices?.[0]?.delta?.content
      if (delta)
        process.stdout.write(delta)
    }
  }

  // 模式二：emitter（多监听器）
  function emit(): void {
    createSSEStream<ChatChunk>(ai.raw, '/chat/completions', { model: 'gpt-4', messages: [], stream: true })
      .on('data', event => console.log(event.data))
      .on('error', err => console.error(err))
      .on('close', () => console.log('[sse] done'))
  }

  return { iterate, emit }
}

// ── 6. Standard Schema 响应校验（配置演示）──
// schema 即类型源：传入后返回类型自动推导，无需手动 <T>；支持 zod 3.24+ / valibot / arktype / 手写。
// 校验对象随响应模式而定：data 模式校验提取后的 data、body 模式校验完整响应体；raw 模式不校验。
function schemaValidation(): { strict: () => Promise<void> } {
  // 手写一个最小 Standard Schema 校验器（零依赖；实际项目通常用 zod：z.object({ id: z.number(), name: z.string() })）
  const userSchema: StandardSchemaV1<unknown, { id: number, name: string }> = {
    '~standard': {
      version: 1,
      vendor: 'example',
      validate: (value) => {
        const v = value as { id?: unknown, name?: unknown }
        return typeof v?.id === 'number' && typeof v?.name === 'string'
          ? { value: { id: v.id, name: v.name } }
          : { issues: [{ message: 'expected { id: number, name: string }' }] }
      },
    },
  }

  const api = createClient({
    prefix: 'https://api.example.com',
    responseParser: { responseReturn: 'data', codeField: 'code', dataField: 'data', successCode: 0 },
    // 三态：strict（默认，失败抛 SchemaValidationError）/ warn（降级 + onValidationError 回调）/ off（不校验）。
    // 库不读 env —— 由调用处用打包器变量映射，让 bundler 把模式固化为常量：
    schemaValidation: process.env.NODE_ENV === 'production' ? 'warn' : 'strict',
    // warn 模式失败上报（提供则取代默认 console.warn）
    onValidationError: issues => console.warn('[schema] drift:', issues),
  })

  // 传 schema → user 自动推导为 { id: number, name: string }，无需手动泛型
  async function strict(): Promise<void> {
    try {
      const user = await api.get('/users/1', { schema: userSchema })
      console.log('[schema]', user.id, user.name)
    }
    catch (error) {
      // strict 校验失败抛 SchemaValidationError（结构层错误，请求本身成功，不触发 onError / makeErrorMessage）
      if (error instanceof SchemaValidationError)
        console.error('[schema] issues:', error.issues)
    }
  }

  return { strict }
}

// 仅基础示例与错误处理实际执行；其余仅构造配置（依赖特定后端）。
async function main(): Promise<void> {
  await basicUsage()
  await errorHandling()

  // 下面仅构造 client / stream，不实际发请求：
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
