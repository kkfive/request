/* eslint-disable no-console */
import type { RequestError } from '../src'
import { Request, to } from '../src'

const request = new Request({
  prefixUrl: 'http://127.0.0.1:4523/m1/3188536-1836903-default',
  makeErrorMessage(message) {
    console.error(`「makeErrorMessage」=>message:${message}`)
  },
  responseParser: {
    responseReturn: 'data',
    dataField: 'data',
    codeField: 'success',
    errorMessageField: 'errorMessage',
    errorCodeField: 'errorCode',
    successCode: code => code === true,
  },
  hooks: {
    afterResponse: [
      (request, options, response) => {
        console.log(`「afterResponse」=>request`)
        return response
      },
    ],
  },
})

async function baseRequest(name: string, url: string): Promise<any> {
  const [error, result] = await to(request.get(url))
  if (error) {
    const _error = error as RequestError
    console.error(`「客户端${name}请求Error」=> errorName:${_error.name};code:${_error.code}`, _error.message, _error.raw)
    return
  }
  console.log(`「客户端${name}请求」=>result:`, result)
  return result
}

async function success(url = '/success'): Promise<any> {
  return baseRequest('success', url)
}
async function errorBusiness(url = '/error/business/500'): Promise<any> {
  return baseRequest('errorBusiness', url)
}
async function errorNetwork(url = '/error/http/500'): Promise<any> {
  return baseRequest('errorNetwork', url)
}

async function main(): Promise<void> {
  await success()
  console.log('----------------------------------')
  await errorBusiness()
  console.log('----------------------------------')
  await errorNetwork()
  console.log('----------------------------------')
  await errorNetwork('/error/http/500-empty')
}
main()
