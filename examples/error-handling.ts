import {
  BusinessError,
  createClient,
  isHTTPError,
  isNetworkError,
  isTimeoutError,
} from '@kkfive/request'

const http = createClient({ prefix: 'https://jsonplaceholder.typicode.com' })

export async function errorHandling(): Promise<void> {
  try {
    await http.get('/posts/0')
  }
  catch (error) {
    if (error instanceof BusinessError)
      console.log('[error] 业务错误', error.code, error.raw)
    else if (isHTTPError(error))
      console.log('[error] HTTP 错误', error.response.status)
    else if (isTimeoutError(error))
      console.log('[error] 超时')
    else if (isNetworkError(error))
      console.log('[error] 网络错误')
    else
      console.log('[error] 未知错误', error)
  }
}
