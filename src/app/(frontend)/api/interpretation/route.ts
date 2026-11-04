import { NextResponse } from 'next/server'
import { getDataset, getAllRows, type PaperRef } from '@/components/util'
import {
  buildRowMapping,
  parseRows,
  resolveBass2Columns,
  summarizeForInterpretation,
  type InterpretationSummary,
} from '@/lib/combustion'
import {
  AI_MODEL,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  aiLimiter,
  cacheKey,
  cachedCall,
  checkQuestion,
  isKnown,
  visitorId,
} from '@/lib/ai-guard'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const INTERPRET_SYSTEM = [
  'You are a careful scientific data interpreter for a fire-safety dashboard.',
  'STRICT RULES:',
  '1. Use ONLY the numerical summary and paper metadata provided in the user message. Never invent measurements, sample sizes, or findings.',
  '2. Distinguish measured results from interpretations. Label interpretations as interpretations.',
  '3. When the summary is insufficient to support a question, say so explicitly.',
  '4. Never describe a material as safe, unsafe, high-risk, or low-risk based on descriptive combustion measurements.',
  '5. State when conclusions are limited by small sample sizes, missing values, censored sensor readings, or microgravity-only conditions.',
  '6. Cite research claims using the paper titles and years provided. Do not fabricate citations.',
  '7. Keep the answer under 120 words, structured as: What the data shows / What it may mean / What remains uncertain.',
  '8. Be concise; use short sentences, not long paragraphs.',
  '9. Do not send or echo the raw dataset.',
].join('\n')

const QUESTION_SYSTEM = `You are a careful scientific data interpreter for a fire-safety dashboard.

STRICT RULES:
1. Use ONLY the numerical summary and paper metadata provided in the user message. Never invent measurements, sample sizes, or findings.
2. Distinguish measured results from interpretations. Label interpretations as interpretations.
3. When the summary is insufficient to support a question, say so explicitly.
4. Never describe a material as safe, unsafe, high-risk, or low-risk based on descriptive combustion measurements.
5. State when conclusions are limited by small sample sizes, missing values, censored sensor readings, or microgravity-only conditions.
6. Cite research claims using the paper titles and years provided. Do not fabricate citations.
7. Keep the answer under 120 words, structured as: What the data shows / What it may mean / What remains uncertain.
8. Be concise; use short sentences, not long paragraphs.`

/** One chat call with the fixed model. Null on any failure: AI is an enhancement, never a hard dependency. */
async function callModel(apiKey: string, system: string, user: string): Promise<string | null> {
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
    // One line per paid call, so spending can be checked in the server log.
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

interface FallbackSection {
  observations: string[]
  interpretations: string[]
  uncertainties: string[]
}

/**
 * Deterministic, data-grounded interpretation built only from the compact
 * summary. Used when no AI service is configured, and always shown alongside
 * AI output so the AI claim can be checked against the raw aggregates.
 */
function buildFallback(summary: InterpretationSummary): FallbackSection {
  const per = Object.entries(summary.byMaterial)
  const observations: string[] = [
    `The current selection contains ${summary.totalTests} test${summary.totalTests === 1 ? '' : 's'} across ${summary.materials.length} material${summary.materials.length === 1 ? '' : 's'}: ${per.map(([m, s]) => `${m} (${s.tests} test${s.tests === 1 ? '' : 's'})`).join(', ') || 'none'}.`,
  ]
  for (const [m, s] of per) {
    const bits: string[] = []
    if (s.o2Conditions > 0) {
      bits.push(`${s.o2Conditions} distinct starting-O₂ condition${s.o2Conditions === 1 ? '' : 's'} spanning ${s.o2Min!.toFixed(1)}–${s.o2Max!.toFixed(1)}% O₂`)
    } else {
      bits.push('no usable starting-O₂ readings')
    }
    if (s.meanO2Consumed !== null) {
      bits.push(`mean O₂ consumed ${s.meanO2Consumed.toFixed(1)}% from ${s.o2ConsumedN} valid reading${s.o2ConsumedN === 1 ? '' : 's'}`)
    } else {
      bits.push('O₂ consumption not measurable (fewer than two valid O₂ readings)')
    }
    if (s.meanCoProduced !== null) bits.push(`mean CO produced ${s.meanCoProduced.toFixed(0)} ppm`)
    if (s.meanCo2Produced !== null) bits.push(`mean CO₂ produced ${s.meanCo2Produced.toFixed(2)}%`)
    observations.push(`${m}: ${bits.join('; ')}.`)
  }
  if (summary.hasCensoredReadings) {
    observations.push(
      `${summary.totalExcluded.censored + summary.totalExcluded.outOfRange} sensor reading${summary.totalExcluded.censored + summary.totalExcluded.outOfRange === 1 ? ' was' : 's were'} censored or out of range (e.g. sensor saturation). Excluded high readings may bias means and maxima low.`,
    )
  }

  const interpretations: string[] = [
    'Materials with more tests and wider O₂-condition coverage (for example the most-tested material here) have stronger descriptive evidence than materials represented by one or two observations.',
  ]
  if (summary.hasCensoredReadings) {
    interpretations.push(
      'Where high gas readings were censored by the sensors, the reported means and maxima likely understate the true peaks; the direction of the bias is known even though the exact values are not.',
    )
  }

  const uncertainties: string[] = [
    'These are descriptive gas measurements from ISS microgravity tests. They do not establish ignition probability, flame spread, crew exposure, or overall fire risk, and they do not directly predict behavior at lunar or Martian gravity.',
    'Results depend on the tested materials, sample sizes, oxygen conditions, airflow, and experimental procedures; single-observation materials cannot support generalizations.',
    'Untested material–oxygen combinations are evidence gaps, not proof of safety or unsafety.',
    'O₂ consumption and gas production depend on sample size, burn duration, and conditions, so values are not comparable across materials without accounting for those factors.',
  ]
  return { observations, interpretations, uncertainties }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const datasetId = params.get('dataset')
  if (!datasetId) {
    return NextResponse.json({ error: 'Query parameter `dataset` is required' }, { status: 400 })
  }
  // The length limit comes before any database or AI work.
  const checked = checkQuestion(params.get('question'))
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 })
  }
  const question = checked.question

  const ds = await getDataset(datasetId)
  if (!ds) {
    return NextResponse.json({ error: 'Dataset not found or not published' }, { status: 404 })
  }
  const rows = await getAllRows(datasetId)

  const { resolutions } = resolveBass2Columns(ds.columns)
  const mapping = buildRowMapping(resolutions)
  const parsedAll = parseRows(rows, mapping)
  // Regenerate the interpretation when the material filter changes.
  const material = params.get('material')
  const parsed =
    material && material !== 'all' ? parsedAll.filter((r) => r.material === material) : parsedAll
  const summary = summarizeForInterpretation(parsed, ds.name)
  const fallback = buildFallback(summary)

  // Research sources actually associated with this dataset, for citation.
  const papers: Array<Partial<PaperRef> & { id: number | string }> = ds.papers.map((p) => ({
    id: p.id,
    title: p.title,
    ntrsId: p.ntrsId,
    sourceUrl: p.sourceUrl,
  }))

  // Original interpretation AI + free-text question AI. Both write into the
  // same summary + papers, so the answer can be grounded and cited. Each is
  // cached by exactly what the model is sent (src/lib/ai-guard.ts).
  const apiKey = process.env.OPEN_ROUTER
  const interpretKey = cacheKey('interpretation', { summary, papers })
  const answerKey = question ? cacheKey('answer', { summary, papers, question }) : null
  const interpretNew = !isKnown(interpretKey)
  const answerNew = answerKey !== null && !isKnown(answerKey)

  // The per-visitor limit counts only requests the server hasn't answered before.
  if (interpretNew || answerNew) {
    const taken = aiLimiter.take(visitorId(request.headers))
    if (!taken.ok) {
      return NextResponse.json(
        {
          error: `Too many new questions: at most ${RATE_LIMIT_MAX} every ${RATE_LIMIT_WINDOW_MS / 60_000} minutes. Try again in ${taken.retryAfterS} s.`,
        },
        { status: 429, headers: { 'Retry-After': String(taken.retryAfterS) } },
      )
    }
  }

  // --- Ask about this dataset (free-text question) -------------------------
  // When a `question` parameter is present the compact summary + question are
  // routed to OpenRouter. The answer is labelled as an interpretation and is
  // returned alongside the deterministic fallback, so a question is never
  // answered without an associated measured summary.
  const [ai, answer] = await Promise.all([
    cachedCall(interpretKey, apiKey ? () => callModel(apiKey, INTERPRET_SYSTEM, JSON.stringify({ summary, papers }, null, 2)) : null),
    answerKey
      ? cachedCall(answerKey, apiKey ? () => callModel(apiKey, QUESTION_SYSTEM, JSON.stringify({ summary, papers, question }, null, 2)) : null)
      : Promise.resolve(null),
  ])

  return NextResponse.json({
    summary,
    papers,
    fallback,
    ai,
    model: ai ? AI_MODEL : null,
    answer,
    answerModel: answer ? AI_MODEL : null,
    cache: { interpretation: interpretNew ? 'new' : 'cached', answer: answerKey ? (answerNew ? 'new' : 'cached') : null },
    allMaterials: [...new Set(parsedAll.map((r) => r.material))].sort(),
  })
}
