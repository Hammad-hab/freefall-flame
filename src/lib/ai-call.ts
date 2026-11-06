import 'server-only'

import { AI_MODEL } from './ai-guard'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * One chat call with the fixed model. Null on any failure: AI is an
 * enhancement, never a hard dependency. Every paid call prints one "[ai]" line
 * with its tokens and cost, so spending can be checked in the server log.
 * Shared by /api/interpretation and /api/psi-interpretation.
 */
export async function callModel(apiKey: string, system: string, user: string): Promise<string | null> {
  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        usage: { include: true }, // OpenRouter adds the call's cost to `usage`
      }),
    })
    const data = (await upstream.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string | null } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
    } | null
    const u = data?.usage
    console.log(
      `[ai] ${AI_MODEL} HTTP ${upstream.status}: ${u?.prompt_tokens ?? '?'} prompt + ${u?.completion_tokens ?? '?'} completion tokens` +
        (typeof u?.cost === 'number' ? `, cost ${u.cost} credits (USD)` : ''),
    )
    return upstream.ok && data?.choices?.[0]?.message?.content ? data.choices[0].message.content : null
  } catch {
    return null
  }
}
