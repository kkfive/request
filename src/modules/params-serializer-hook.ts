import type { BeforeRequestHook } from 'ky'
import type { RequestOption } from '../type'
import qs from 'qs'

const paramsSerializerHook: BeforeRequestHook = (request, options) => {
  const custom = options as RequestOption
  if (custom.params) {
    const search = qs.stringify(custom.params, {
      arrayFormat: custom.paramsSerializer || 'comma',
    })
    const url = new URL(request.url)
    url.search = search

    // 返回一个新的 Request 实例，而不是修改原有的
    return new Request(url.toString(), request)
  }
}
export { paramsSerializerHook }
