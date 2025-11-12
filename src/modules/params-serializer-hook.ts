import type { BeforeRequestHook } from 'ky'
import type { RequestOption } from '../type'
import qs from 'qs'
import { merge } from '../utils/merge'

const paramsSerializerHook: BeforeRequestHook = (request, options) => {
  const custom = options as RequestOption
  if (!custom.params || Object.keys(custom.params).length === 0) {
    return
  }

  const url = new URL(request.url)
  const existingParams = qs.parse(url.search, {
    ignoreQueryPrefix: true,
  }) as Record<string, any>

  const mergedParams = merge(
    merge({}, existingParams),
    custom.params,
  )

  const search = qs.stringify(mergedParams, {
    arrayFormat: custom.paramsSerializer || 'comma',
  })

  url.search = search

  return new Request(url.toString(), request)
}
export { paramsSerializerHook }
