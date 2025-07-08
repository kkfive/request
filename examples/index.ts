/* eslint-disable no-console */
import type { RequestError } from '../src'
import { Request } from '../src'

const request = new Request({
  prefixUrl: 'http://127.0.0.1:4523/m1/3188536-1836903-default/',
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

async function success(url = 'success'): Promise<any> {
  const result = await request.get(url)
  console.log(`「客户端success请求」=>result:`, result)
  return result
}
async function errorBusiness(url = 'error/business/500'): Promise<any> {
  try {
    const result = await request.get(url)
    console.log(`「客户端errorBusiness请求」=>result:`, result)
    return result
  }
  catch (error) {
    const _error = error as RequestError
    console.error(`「客户端errorBusiness请求Error」=> errorName:${_error.name};code:${_error.code}`, _error.message, _error.raw)
  }
}
async function errorNetwork(url = 'error/http/500'): Promise<any> {
  try {
    const result = await request.get(url)
    console.log(`「客户端errorNetwork请求」=>result:`, result)
    return result
  }
  catch (error) {
    const _error = error as RequestError
    console.error(`「客户端errorNetwork请求Error」=> errorName:${_error.name};code:${_error.code}`, _error.message, _error.raw)
  }
}

async function main(): Promise<void> {
  await success()
  console.log('----------------------------------')
  await errorBusiness()
  console.log('----------------------------------')
  await errorNetwork()
  console.log('----------------------------------')
  await errorNetwork('error/http/500-empty')
}
main()
