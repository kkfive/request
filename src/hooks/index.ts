// 内置 hooks
export {
  createAuthHook,
  createContentTypeHook,
  createResponseParserHook,
  createUnauthorizedHook,
  paramsSerializerHook,
} from './builtin'

// Hook 解析器
export { resolveHooks } from './registry'
