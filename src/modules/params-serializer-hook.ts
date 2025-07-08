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
    Object.defineProperty(request, 'url', { value: url.toString() })
  }
}
export { paramsSerializerHook }
