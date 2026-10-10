import { NextResponse } from 'next/server'

const OPEN_ROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Default model can be overridden per request; keep it cheap and generally available.
const DEFAULT_MODEL = 'openai/gpt-4o-mini'

interface OpenRouterChoice {
  message?: { content?: string | null }
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[]
  error?: { message?: string }
}

export async function POST(request: Request) {
  const apiKey = process.env.OPEN_ROUTER
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPEN_ROUTER is not set on the server' },
      { status: 500 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { prompt, model, system } = (body ?? {}) as {
    prompt?: string
    model?: string
    system?: string
  }

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: '`prompt` is required' }, { status: 400 })
  }

  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: prompt },
  ]

  let upstream: Response
  try {
    upstream = await fetch(OPEN_ROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages,
      }),
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach OpenRouter: ${(err as Error).message}` },
      { status: 502 },
    )
  }

  const data = (await upstream.json().catch(() => null)) as OpenRouterResponse | null

  if (!upstream.ok || !data) {
    return NextResponse.json(
      { error: data?.error?.message ?? `OpenRouter returned ${upstream.status}` },
      { status: upstream.status >= 400 ? upstream.status : 502 },
    )
  }

  const output = data.choices?.[0]?.message?.content ?? ''

  return NextResponse.json({ output, model: model || DEFAULT_MODEL })
}
