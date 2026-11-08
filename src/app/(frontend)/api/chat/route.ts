import 'server-only'
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { AI_MODEL } from '@/lib/ai-guard' // adjust path

export const maxDuration = 60

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const SYSTEM = 'You are a helpful assistant.' // put your combustion-specific prompt here

type Part = { type: string; text?: string }
type UIMsg = { role: 'user' | 'assistant' | 'system'; parts?: Part[] }

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return new Response('Missing OPENROUTER_API_KEY', { status: 500 })

  const { messages } = (await req.json()) as { messages: UIMsg[] }
  const chat = messages.map((m) => ({
    role: m.role,
    content: (m.parts ?? []).filter((p) => p.type === 'text').map((p) => p.text ?? '').join(''),
  }))

  const upstream = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      stream: true,
      usage: { include: true },
      messages: [{ role: 'system', content: SYSTEM }, ...chat],
    }),
    signal: req.signal,
  }).catch(() => null)

  if (!upstream || !upstream.ok || !upstream.body) {
    console.log(`[ai] ${AI_MODEL} HTTP ${upstream?.status ?? 'fetch failed'}`)
    return new Response('Upstream error', { status: 502 })
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const id = crypto.randomUUID()
      writer.write({ type: 'text-start', id })

      const reader = upstream.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let usage: { prompt_tokens?: number; completion_tokens?: number; cost?: number } | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue // skips ": OPENROUTER PROCESSING" keepalives
          const payload = line.slice(6).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const json = JSON.parse(payload)
            const delta = json.choices?.[0]?.delta?.content
            if (delta) writer.write({ type: 'text-delta', id, delta })
            if (json.usage) usage = json.usage
          } catch {
            /* partial or malformed chunk, ignore */
          }
        }
      }

      writer.write({ type: 'text-end', id })
      console.log(
        `[ai] ${AI_MODEL} HTTP ${upstream.status}: ${usage?.prompt_tokens ?? '?'} prompt + ${usage?.completion_tokens ?? '?'} completion tokens` +
          (typeof usage?.cost === 'number' ? `, cost ${usage.cost} credits (USD)` : ''),
      )
    },
    onError: () => 'Something went wrong.',
  })

  return createUIMessageStreamResponse({ stream })
}