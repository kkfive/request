import type { StandardSchemaV1 } from '@kkfive/request'
import process from 'node:process'
import { createClient, SchemaValidationError } from '@kkfive/request'

const userSchema: StandardSchemaV1<unknown, { id: number, name: string }> = {
  '~standard': {
    version: 1,
    vendor: 'example',
    validate: (value) => {
      const v = value as { id?: unknown, name?: unknown }
      return typeof v?.id === 'number' && typeof v?.name === 'string'
        ? { value: { id: v.id, name: v.name } }
        : { issues: [{ message: 'expected { id: number, name: string }' }] }
    },
  },
}

export function schemaValidation(): { strict: () => Promise<void> } {
  const api = createClient({
    prefix: 'https://api.example.com',
    responseParser: { responseReturn: 'data', codeField: 'code', dataField: 'data', successCode: 0 },
    schemaValidation: process.env.NODE_ENV === 'production' ? 'warn' : 'strict',
    onValidationError: issues => console.warn('[schema] drift:', issues),
  })

  async function strict(): Promise<void> {
    try {
      const user = await api.get('/users/1', { schema: userSchema })
      console.log('[schema]', user.id, user.name)
    }
    catch (error) {
      if (error instanceof SchemaValidationError)
        console.error('[schema] issues:', error.issues)
    }
  }

  return { strict }
}
