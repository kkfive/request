import { Request } from './request'

export * from './errors/app-error/index'
export * from './request'
export type { ResponseParserOptions } from './type'

const request = Request.create()

export { request }
