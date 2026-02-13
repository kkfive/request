import type { BeforeRequestHook } from 'ky'
import type { RequestConfig } from '../../types'
import qs from 'qs'

/**
 * 参数序列化 Hook
 * 将 params 对象序列化为 URL 查询字符串
 */
const paramsSerializerHook: BeforeRequestHook = (request, options) => {
  const custom = options as RequestConfig
  if (custom.params) {
    const search = qs.stringify(custom.params, {
      arrayFormat: custom.paramsSerializer || 'comma',
    })
    const url = new URL(request.url)
    url.search = search

    return new Request(url.toString(), request)
  }
}

export { paramsSerializerHook }
