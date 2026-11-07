/**
 * Plain-language summaries of the PSI catalogue: one per investigation
 * (?id=bass-ii) and one for the overall ranking at equal weights
 * (?id=overall). The model is sent only that card's facts from psi.json, and
 * any answer with a number not in those facts, or too general (the overall
 * summary must name at least three investigations; no phrases like "higher
 * scores indicate"), is replaced by the plain summary (src/lib/psi-ai.ts).
 * Same guard as /api/interpretation: fixed
 * model, per-visitor limit on new requests, daily cap on paid calls, and a
 * cache keyed by exactly what the model is sent.
 */
import { NextResponse } from 'next/server'
import data from '@/app/(frontend)/dashboard/components/investigations/psi.json'
import type { PsiCatalogue } from '@/lib/psi'
import { numbersNotInFacts, psiFacts, psiFallback, systemFor, tooGeneral } from '@/lib/psi-ai'
import {
  AI_MODEL,
  DAILY_PAID_CAP,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  aiDailyCap,
  aiLimiter,
  cacheKey,
  cachedCall,
  isKnown,
  visitorId,
} from '@/lib/ai-guard'
import { callModel } from '@/lib/ai-call'

const catalogue = data as PsiCatalogue

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? ''
  const facts = /^[a-z0-9-]{1,40}$/.test(id) ? psiFacts(catalogue, id) : null
  const fallback = facts ? psiFallback(catalogue, id) : null
  if (!facts || !fallback) return NextResponse.json({ error: 'Unknown investigation' }, { status: 404 })

  const apiKey = process.env.OPEN_ROUTER
  const system = systemFor(id)
  const key = cacheKey('psi', { system, facts })
  const isNew = !isKnown(key)

  // The per-visitor limit counts only requests the server hasn't answered before.
  if (isNew) {
    const taken = aiLimiter.take(visitorId(request.headers))
    if (!taken.ok) {
      return NextResponse.json(
        { error: `Too many new questions: at most ${RATE_LIMIT_MAX} every ${RATE_LIMIT_WINDOW_MS / 60_000} minutes. Try again in ${taken.retryAfterS} s.`, fallback },
        { status: 429, headers: { 'Retry-After': String(taken.retryAfterS) } },
      )
    }
  }
  const capped = aiDailyCap.take(apiKey && isNew ? 1 : 0)
  if (!capped.ok) {
    return NextResponse.json(
      { error: `The dashboard's daily limit of ${DAILY_PAID_CAP} AI answers has been reached. AI answers start again at midnight UTC.`, fallback },
      { status: 429, headers: { 'Retry-After': String(capped.retryAfterS) } },
    )
  }

  const answer = await cachedCall(key, apiKey ? () => callModel(apiKey, system, JSON.stringify(facts, null, 2)) : null)
  // Both checks run on every answer, cached or new: no number that isn't in
  // the facts, and specific enough (names investigations, no general phrases).
  const invented = answer ? numbersNotInFacts(answer, facts) : []
  const general = answer && invented.length === 0 ? tooGeneral(answer, catalogue, id) : null
  const ai = answer && invented.length === 0 && !general ? answer : null
  const rejected = !answer
    ? null
    : invented.length
      ? `The AI answer used numbers not in the data (${invented.join(', ')}), so the plain summary is shown instead.`
      : general
        ? `The AI answer was too general (${general}), so the plain summary is shown instead.`
        : null
  return NextResponse.json({
    id,
    fallback,
    ai,
    model: ai ? AI_MODEL : null,
    rejected,
    cache: isNew ? 'new' : 'cached',
  })
}
