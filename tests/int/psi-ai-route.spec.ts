// @vitest-environment node
/**
 * /api/psi-interpretation with the model call mocked (no network, no paid
 * call): an overall answer that gives an interpretation as a fact is
 * replaced by the plain summary; the real proof answer is shown.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const callModel = vi.fn()
vi.mock('@/lib/ai-call', () => ({ callModel: (...a: unknown[]) => callModel(...a) }))

const PROOF = `### Top of the ranking
1. **BASS-II** (PSI-25): 129 tests, partial outcomes for 26 of 129.
2. **Saffire I-III** (PSI-98/99/100): 13 tests, outcomes recorded as burn time, spread.
2. **SAME-R** (PSI-101): 109 tests, outcomes not recorded in table.

### What separates them
The top three investigations hold high scores in habitat materials and cabin airflow (2 points), while those ranked lower lack either robust test counts or outcomes.

### What the tables can't tell us
10 tables recorded no outcomes per test, including "BASS," "SAME," and "SPICE."`

const savedKey = process.env.OPEN_ROUTER
beforeEach(() => {
  // A fresh route and a fresh guard: the answer cache lives on globalThis (src/lib/ai-guard.ts).
  vi.resetModules()
  delete (globalThis as { __aiGuard?: unknown }).__aiGuard
  callModel.mockReset()
  process.env.OPEN_ROUTER = 'test-key-not-real' // the mocked call never uses it; the real key is never touched
})
afterEach(() => { process.env.OPEN_ROUTER = savedKey })

async function ask(answer: string) {
  callModel.mockResolvedValueOnce(answer)
  const { GET } = await import('@/app/(frontend)/api/psi-interpretation/route')
  const res = await GET(new Request('http://127.0.0.1/api/psi-interpretation?id=overall', { headers: { 'x-forwarded-for': '10.0.0.1' } }))
  return (await res.json()) as { ai: string | null; rejected: string | null; fallback: string[] }
}

describe('PSI summary route, model mocked', () => {
  it('shows the proof answer: its interpretation is under "What separates them"', async () => {
    const r = await ask(PROOF)
    expect(callModel).toHaveBeenCalledTimes(1)
    expect(callModel.mock.calls[0][1]).toContain('12. Anything that interprets rather than states a fact')
    expect(r.ai).toBe(PROOF)
    expect(r.rejected).toBeNull()
  })

  it('replaces an answer that states an interpretation as a fact elsewhere with the plain summary', async () => {
    const bad = PROOF.replace('including "BASS," "SAME," and "SPICE."', 'including "BASS," "SAME," and "SPICE," which probably hides many failed tests.')
    const r = await ask(bad)
    expect(r.ai).toBeNull()
    expect(r.rejected).toMatch(/^The AI answer gave an interpretation as a fact \("10 tables recorded no outcomes per test/)
    expect(r.fallback[0]).toMatch(/^Top of the ranking \(equal weights\): BASS-II 90/)
  })

  it('accepts the same thought when it is marked "This suggests"', async () => {
    const marked = PROOF.replace('including "BASS," "SAME," and "SPICE."', 'including "BASS," "SAME," and "SPICE." This suggests many results are simply unknown.')
    const r = await ask(marked)
    expect(r.ai).toBe(marked)
  })
})
