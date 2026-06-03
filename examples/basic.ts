import { createClient } from '@kkfive/request'

const http = createClient({ prefix: 'https://jsonplaceholder.typicode.com' })

export async function basicUsage(): Promise<void> {
  const users = await http.get<Array<{ id: number, name: string }>>('/users')
  console.log('[basic] users:', users.length)

  const created = await http.post<{ id: number }>('/posts', { title: 'kk', body: 'hi', userId: 1 })
  console.log('[basic] created id:', created.id)
}
