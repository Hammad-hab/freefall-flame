import { NextResponse } from 'next/server'
import { getDataset, getAllRows, type PaperRef } from '@/components/util'
import {
  buildRowMapping,
  parseRows,
  resolveBass2Columns,
  summarizeForInterpretation,
  type InterpretationSummary,
} from '@/lib/combustion'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-4o-mini'

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
  const datasetId = new URL(request.url).searchParams.get('dataset')
  if (!datasetId) {
    return NextResponse.json({ error: 'Query parameter `dataset` is required' }, { status: 400 })
  }

  const ds = await getDataset(datasetId)
  if (!ds) {
    return NextResponse.json({ error: 'Dataset not found or not published' }, { status: 404 })
  }
  const rows = await getAllRows(datasetId)

  const { resolutions } = resolveBass2Columns(ds.columns)
  const mapping = buildRowMapping(resolutions)
  const parsedAll = parseRows(rows, mapping)
  // Regenerate the interpretation when the material filter changes.
  const material = new URL(request.url).searchParams.get('material')
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

  const question = new URL(request.url).searchParams.get('question')
  let ai: string | null = null
  let model: string | null = null
  let answer: string | null = null
  let answerModel: string | null = null
  const apiKey = process.env.OPEN_ROUTER

  // Original interpretation AI + free-text question AI. Both write into the
  // same summary + papers, so the answer can be grounded and cited.
  if (apiKey) {
    try {
      const system = [
        'You are a careful scientific data interpreter for a fire-safety dashboard.',
        'STRICT RULES:',
        '1. Use ONLY the numerical summary and paper metadata provided in the user message. Never invent measurements, sample sizes, or findings.',
        '2. Distinguish measured results from interpretations. Label interpretations as interpretations.',
        '3. When the summary is insufficient to support a question, say so explicitly.',
        '4. Never describe a material as safe, unsafe, high-risk, or low-risk based on descriptive combustion measurements.',
        '5. State when conclusions are limited by small sample sizes, missing values, censored sensor readings, or microgravity-only conditions.',
        '6. Cite research claims using the paper titles and years provided. Do not fabricate citations.',
        '7. Keep the answer under 350 words, structured as: What the data shows / What it may mean / What remains uncertain.',
        '8. Do not send or echo the raw dataset.',
      ].join('\n')
      const user = JSON.stringify({ summary, papers }, null, 2)
      const upstream = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      })
      const data = (await upstream.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string | null } }>
        error?: { message?: string }
      } | null
      if (upstream.ok && data?.choices?.[0]?.message?.content) {
        ai = data.choices[0].message.content
        model = DEFAULT_MODEL
      }
    } catch {
      // Original AI is an enhancement, never a hard dependency: fall through to the deterministic summary.
    }
  }

  // --- Ask about this dataset (free-text question) -------------------------
  // When a `question` parameter is present the compact summary + question are
  // routed to OpenRouter. The answer is labelled as an interpretation and is
  // returned alongside the deterministic fallback, so a question is never
  // answered without an associated measured summary.
  if (question && apiKey) {
    try {
      const system = `You are a careful scientific data interpreter for a fire-safety dashboard.

STRICT RULES:
1. Use ONLY the numerical summary and paper metadata provided in the user message. Never invent measurements, sample sizes, or findings.
2. Distinguish measured results from interpretations. Label interpretations as interpretations.
3. When the summary is insufficient to support a question, say so explicitly.
4. Never describe a material as safe, unsafe, high-risk, or low-risk based on descriptive combustion measurements.
5. State when conclusions are limited by small sample sizes, missing values, censored sensor readings, or microgravity-only conditions.
6. Cite research claims using the paper titles and years provided. Do not fabricate citations.
7. Keep the answer under 350 words, structured as: What the data shows / What it may mean / What remains uncertain.`

      const user = JSON.stringify({ summary, papers, question }, null, 2)
      const upstream = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      })
      const data = (await upstream.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string | null } }>
        error?: { message?: string }
      } | null
      if (upstream.ok && data?.choices?.[0]?.message?.content) {
        answer = data.choices[0].message.content
        answerModel = DEFAULT_MODEL
      }
    } catch {
      // Question answering is an enhancement, never a hard dependency; keep the
      // deterministic summary so the ask panel still renders something.
    }
  }

  return NextResponse.json({ summary, papers, fallback, ai, model, answer, answerModel, allMaterials: [...new Set(parsedAll.map((r) => r.material))].sort() })
}
}}, null, 2)
      const upstream = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      })
      const data = (await upstream.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string | null } }>
        error?: { message?: string }
      } | null
      const question = new URL(request.url).searchParams.get('question')

      // --- Ask about this dataset (free-text question) -------------------------
      // When a `question` parameter is present the compact summary + question are
      // routed to OpenRouter. The answer is labelled as an interpretation and is
      // returned alongside the deterministic fallback, so a question is never
      // answered without an associated measured summary.
      if (question && apiKey) {
        try {
          const system = `You are a careful scientific data interpreter for a fire-safety dashboard.

STRICT RULES:
1. Use ONLY the numerical summary and paper metadata provided in the user message. Never invent measurements, sample sizes, or findings.
2. Distinguish measured results from interpretations. Label interpretations as interpretations.
3. When the summary is insufficient to support a question, say so explicitly.
4. Never describe a material as safe, unsafe, high-risk, or low-risk based on descriptive combustion measurements.
5. State when conclusions are limited by small sample sizes, missing values, censored sensor readings, or microgravity-only conditions.
6. Cite research claims using the paper titles and years provided. Do not fabricate citations.
7. Keep the answer under 350 words, structured as: What the data shows / What it may mean / What remains uncertain.`

          const user = JSON.stringify({ summary, papers, question }, null, 2)
          const upstream = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
          })
          const data = (await upstream.json().catch(() => null)) as {
            choices?: Array<{ message?: { content?: string | null } }>
            error?: { message?: string }
          } | null
          if (upstream.ok && data?.choices?.[0]?.message?.content) {
            answer = data.choices[0].message.content
            answerModel = DEFAULT_MODEL
          }
        } catch {
          // Question answering is an enhancement, never a hard dependency; keep the
          // deterministic summary so the ask panel still renders something.
        }
      }

      return NextResponse.json({ summary, papers, fallback, ai, model, answer, answerModel, allMaterials: [...new Set(parsedAll.map((r) => r.material))].sort() })
    } catch (e) {
      console.error(e)
    }
}
}