import process from 'node:process'
import { createClient } from '@kkfive/request'

interface ChatChunk { choices?: Array<{ delta?: { content?: string } }> }

export function sseExamples(): { iterate: () => Promise<void>, emit: () => void } {
  const ai = createClient({ prefix: 'https://api.openai.com/v1', auth: { getToken: () => 'sk-xxx' } })

  async function iterate(): Promise<void> {
    const stream = ai.sse<ChatChunk>('/chat/completions', {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
    })
    for await (const event of stream) {
      const delta = event.data?.choices?.[0]?.delta?.content
      if (delta)
        process.stdout.write(delta)
    }
  }

  function emit(): void {
    ai.sse<ChatChunk>('/chat/completions', { model: 'gpt-4', messages: [], stream: true })
      .on('data', event => console.log(event.data))
      .on('error', err => console.error(err))
      .on('close', () => console.log('[sse] done'))
  }

  return { iterate, emit }
}
