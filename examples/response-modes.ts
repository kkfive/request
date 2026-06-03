import { createClient } from '@kkfive/request'

export function responseModes(): void {
  createClient({ responseParser: { responseReturn: 'raw' } })
  createClient({ responseParser: { responseReturn: 'body' } })
  createClient({
    responseParser: {
      responseReturn: 'data',
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    },
  })
}
