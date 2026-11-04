import { describe, expect, it } from 'vitest'
import {
  LruCache,
  QUESTION_MAX_CHARS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  RateLimiter,
  aiCache,
  cacheKey,
  cachedCall,
  checkQuestion,
  visitorId,
} from '@/lib/ai-guard'

describe('checkQuestion', () => {
  it('treats missing and blank as no question', () => {
    expect(checkQuestion(null)).toEqual({ ok: true, question: null })
    expect(checkQuestion('   \n ')).toEqual({ ok: true, question: null })
  })
  it('collapses whitespace before measuring', () => {
    expect(checkQuestion('  why   so\n\tlow?  ')).toEqual({ ok: true, question: 'why so low?' })
    expect(checkQuestion(' '.repeat(2000) + 'x')).toEqual({ ok: true, question: 'x' })
  })
  it(`accepts ${QUESTION_MAX_CHARS} characters and refuses ${QUESTION_MAX_CHARS + 1}`, () => {
    expect(checkQuestion('a'.repeat(QUESTION_MAX_CHARS)).ok).toBe(true)
    const r = checkQuestion('a'.repeat(QUESTION_MAX_CHARS + 1))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.length).toBe(QUESTION_MAX_CHARS + 1)
  })
})

describe('RateLimiter', () => {
  it(`allows ${RATE_LIMIT_MAX} per window, then refuses until the oldest expires`, () => {
    let t = 1_000_000
    const lim = new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, () => t)
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(lim.take('a').ok).toBe(true)
      t += 1000
    }
    const refused = lim.take('a')
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.retryAfterS).toBe(RATE_LIMIT_WINDOW_MS / 1000 - RATE_LIMIT_MAX)
    expect(lim.take('b').ok).toBe(true) // another visitor is not affected
    t = 1_000_000 + RATE_LIMIT_WINDOW_MS // the first request has left the window
    expect(lim.take('a').ok).toBe(true)
    expect(lim.take('a').ok).toBe(false)
  })
})

describe('visitorId', () => {
  it('uses the first x-forwarded-for address, then x-real-ip', () => {
    expect(visitorId(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5')
    expect(visitorId(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
    expect(visitorId(new Headers())).toBe('unknown')
  })
})

describe('cache', () => {
  it('evicts the least recently used entry', () => {
    const c = new LruCache<number>(2)
    c.set('a', 1)
    c.set('b', 2)
    c.get('a') // a is now newest
    c.set('c', 3)
    expect(c.has('a')).toBe(true)
    expect(c.has('b')).toBe(false)
    expect(c.size).toBe(2)
  })

  it('keys on everything the model is sent', () => {
    const base = { summary: { n: 1 }, papers: [] }
    expect(cacheKey('answer', { ...base, question: 'q' })).toBe(cacheKey('answer', { ...base, question: 'q' }))
    expect(cacheKey('answer', { ...base, question: 'q' })).not.toBe(cacheKey('answer', { ...base, question: 'r' }))
    expect(cacheKey('answer', base)).not.toBe(cacheKey('interpretation', base))
  })

  it('pays once for two identical requests at once, then serves the cache', async () => {
    let calls = 0
    const call = async () => {
      calls += 1
      await new Promise((r) => setTimeout(r, 20))
      return 'text'
    }
    const key = cacheKey('interpretation', { test: 'concurrent' })
    const [a, b] = await Promise.all([cachedCall(key, call), cachedCall(key, call)])
    expect([a, b, calls]).toEqual(['text', 'text', 1])
    expect(await cachedCall(key, call)).toBe('text')
    expect(calls).toBe(1)
  })

  it('retries a failed call, but caches "no AI configured"', async () => {
    let calls = 0
    const failing = async () => {
      calls += 1
      return null
    }
    const key = cacheKey('interpretation', { test: 'failure' })
    await cachedCall(key, failing)
    await cachedCall(key, failing)
    expect(calls).toBe(2)
    expect(aiCache.has(key)).toBe(false)

    const noAi = cacheKey('interpretation', { test: 'no key' })
    expect(await cachedCall(noAi, null)).toBe(null)
    expect(aiCache.has(noAi)).toBe(true)
  })
})
