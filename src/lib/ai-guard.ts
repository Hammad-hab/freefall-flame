// ai-guard.ts - the limits around the paid AI calls in /api/interpretation
// (the Overview assistant and the Interpretation tab).
//
// - The model is fixed here, on the server. Nothing from the browser chooses it.
// - A question is at most QUESTION_MAX_CHARS characters (after trimming and
//   collapsing whitespace).
// - Each interpretation and each answer is cached in memory, keyed by exactly
//   what the model is sent (prompt version, model, dataset summary, papers and
//   question), so the same experiment is never paid for twice while the server
//   runs. The cache is per server process: a restart, or a second instance,
//   starts empty.
// - Per visitor (by IP address), at most RATE_LIMIT_MAX requests the server
//   has not answered before, in any RATE_LIMIT_WINDOW_MS. Answers served from
//   the cache don't count.

import { createHash } from 'node:crypto'
import { QUESTION_MAX_CHARS } from './ai-limits'

export { QUESTION_MAX_CHARS }
export const AI_MODEL = 'openai/gpt-4o-mini'
/** Change this whenever a prompt changes, so old cached answers aren't reused. */
export const PROMPT_VERSION = 1
export const RATE_LIMIT_MAX = 10
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const CACHE_MAX_ENTRIES = 500
const LIMITER_MAX_VISITORS = 10_000

/** The visitor's IP address, as the host reports it. */
export function visitorId(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
}

export type QuestionCheck =
  | { ok: true; question: string | null }
  | { ok: false; error: string; length: number }

/** Normalise a question and check its length. Empty means no question. */
export function checkQuestion(raw: string | null): QuestionCheck {
  if (raw === null) return { ok: true, question: null }
  const question = raw.replace(/\s+/g, ' ').trim()
  if (question === '') return { ok: true, question: null }
  if (question.length > QUESTION_MAX_CHARS) {
    return {
      ok: false,
      length: question.length,
      error: `The question is too long: ${question.length} characters, at most ${QUESTION_MAX_CHARS}.`,
    }
  }
  return { ok: true, question }
}

/** A sliding-window limit: at most `max` takes per id in any `windowMs`. */
export class RateLimiter {
  private hits = new Map<string, number[]>()

  constructor(
    readonly max: number,
    readonly windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Count one request for `id`, unless the limit is reached. */
  take(id: string): { ok: true } | { ok: false; retryAfterS: number } {
    const t = this.now()
    const recent = (this.hits.get(id) ?? []).filter((h) => t - h < this.windowMs)
    if (recent.length >= this.max) {
      this.hits.set(id, recent)
      return { ok: false, retryAfterS: Math.max(1, Math.ceil((recent[0] + this.windowMs - t) / 1000)) }
    }
    recent.push(t)
    this.hits.set(id, recent)
    if (this.hits.size > LIMITER_MAX_VISITORS) this.prune(t)
    return { ok: true }
  }

  private prune(t: number) {
    for (const [id, list] of this.hits) {
      if (list.every((h) => t - h >= this.windowMs)) this.hits.delete(id)
    }
  }
}

/** A small least-recently-used cache. */
export class LruCache<V> {
  private map = new Map<string, V>()

  constructor(readonly maxEntries: number) {}

  has(key: string): boolean {
    return this.map.has(key)
  }

  get(key: string): V | undefined {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key) as V
    this.map.delete(key) // move to the newest end
    this.map.set(key, value)
    return value
  }

  set(key: string, value: V): void {
    this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as string
      this.map.delete(oldest)
    }
  }

  get size(): number {
    return this.map.size
  }
}

/** The cache key: a hash of everything the model would be sent. */
export function cacheKey(kind: 'interpretation' | 'answer', payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify({ v: PROMPT_VERSION, model: AI_MODEL, kind, payload }))
    .digest('hex')
}

// One limiter and one cache per server process. Kept on globalThis so the dev
// server's hot reload doesn't start new ones on every edit.
const g = globalThis as typeof globalThis & {
  __aiGuard?: {
    limiter: RateLimiter
    cache: LruCache<string | null>
    inflight: Map<string, Promise<string | null>>
  }
}
g.__aiGuard ??= {
  limiter: new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS),
  cache: new LruCache<string | null>(CACHE_MAX_ENTRIES),
  inflight: new Map(),
}
export const aiLimiter = g.__aiGuard.limiter
/** Cached model output; null means "no AI configured" (nothing to retry). */
export const aiCache = g.__aiGuard.cache
/** Calls still running, so two identical requests at once pay only once. */
export const aiInflight = g.__aiGuard.inflight

/** True if this key is answered already, or is being answered right now. */
export function isKnown(key: string): boolean {
  return aiCache.has(key) || aiInflight.has(key)
}

/**
 * The cached answer for `key`, or the result of `call()` (shared with any
 * identical request already waiting). A null from a configured AI (a failed
 * call) isn't cached, so the next request tries again.
 */
export function cachedCall(
  key: string,
  call: (() => Promise<string | null>) | null,
): Promise<string | null> {
  if (aiCache.has(key)) return Promise.resolve(aiCache.get(key) ?? null)
  const pending = aiInflight.get(key)
  if (pending) return pending
  const p = (async () => {
    const out = call ? await call() : null
    if (out !== null || call === null) aiCache.set(key, out)
    return out
  })().finally(() => aiInflight.delete(key))
  aiInflight.set(key, p)
  return p
}
