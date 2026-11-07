/**
 * What the AI is told about the PSI catalogue, the plain summary shown when
 * there is no AI answer, and the number check every AI answer must pass.
 * Pure functions: no React, no network.
 */
import { CRITERIA, DEFAULT_WEIGHTS, rank, type PsiCatalogue, type PsiFact } from './psi'

const SHARED_RULES = [
  'You summarise NASA combustion investigations for a crew-habitat fire-safety dashboard.',
  'STRICT RULES:',
  '1. Use ONLY the facts JSON in the user message. Never invent measurements, test counts, results or papers.',
  '2. Every number you write must appear in the facts JSON exactly as given. Do not round, convert or compute new numbers.',
  '3. Say what the table does not hold (for example outcomes) when the facts say so.',
  '4. The relevance score is how directly the data speaks to habitat fire safety. It is NOT fire risk. Never call a material or investigation safe, unsafe, high-risk or low-risk.',
  '5. Label interpretations as interpretations.',
  '6. Cite only the PSI id and the paper titles in the facts.',
]

/** One investigation's summary (an "Explain" button on its card). */
export const PSI_SYSTEM = [
  ...SHARED_RULES,
  '7. Under 120 words, structured as: What the data shows / What it may mean for habitats / What remains uncertain.',
].join('\n')

/** The overall ranking's summary: it must name investigations and their facts, not talk about scores in general. */
export const PSI_OVERALL_SYSTEM = [
  ...SHARED_RULES,
  '7. Name at least three investigations. For each, give one specific fact from the facts (its test count, its oxygen range, or what its table records about outcomes) and the criterion that raises or lowers its score.',
  '8. Say which criteria separate the top three from the rest, using the criterion scores in the facts.',
  '9. Name the tables that record no outcome per test, or give their count.',
  '10. Do not write general statements about scoring, such as "higher scores indicate".',
  '11. Under 130 words, with three headings: Top of the ranking / What separates them / What the tables can\'t tell us.',
].join('\n')

export type PsiTarget = 'overall' | string

/** The system prompt for a target: the overall ranking has its own rules. */
export const systemFor = (target: PsiTarget) => (target === 'overall' ? PSI_OVERALL_SYSTEM : PSI_SYSTEM)

/** "a", "a and b", "a, b and c". */
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** Tables with no outcome per test (none, or only flames ignited per day). */
const noOutcome = (outcomeRecorded: string) => /^no/.test(outcomeRecorded) || /per day only/.test(outcomeRecorded)

const factText = (f: PsiFact): string => {
  if (f.kind === 'count') return `${f.label}: ${f.items.map((i) => `${i.value} ${i.count}`).join(', ')}`
  if (f.kind === 'range') return `${f.label}: ${f.min} to ${f.max} ${f.unit} (${f.n} values)`
  if (f.kind === 'sum') return `${f.label}: ${f.value} (over ${f.n} rows)`
  return `${f.label}: ${f.text}`
}

/** The facts the model is sent for one investigation, or for the overall ranking (default weights). Null for an unknown id. */
export function psiFacts(cat: PsiCatalogue, target: PsiTarget): Record<string, unknown> | null {
  const ranked = rank(cat.investigations, DEFAULT_WEIGHTS)!
  if (target === 'overall') {
    const none = cat.investigations.filter((i) => noOutcome(i.outcomeRecorded))
    return {
      what: 'ranking of NASA PSI combustion investigations by relevance to crew-habitat fire safety, equal weights',
      formula: 'score = sum(weight x criterion) / (2 x sum(weights)) x 100; each criterion 0, 1 or 2; all weights 1',
      criteria: CRITERIA.map((c) => `${c.label}${'judgement' in c && c.judgement ? ' (our judgement)' : ''}: ${c.help}`),
      habitatReference: [cat.reference.iss.text, cat.reference.exploration.text, cat.reference.ventilation.text],
      investigations: cat.investigations.length,
      ranking: ranked.map((r) => {
        const inv = cat.investigations.find((i) => i.id === r.id)!
        return {
          rank: r.rank,
          name: r.name,
          psiId: inv.psiId,
          score: r.score,
          fuelPhase: inv.fuelPhase,
          tests: inv.tests,
          oxygenPct: inv.o2Pct,
          outcomesInTable: inv.outcomeRecorded,
          criterionScores: Object.fromEntries(CRITERIA.map((c) => [c.label, inv.scores[c.key].score])),
          whatWeSimulated: `${inv.simulation.label}: ${inv.simulation.reason}`,
        }
      }),
      tablesWithNoOutcomePerTest: { count: none.length, names: none.map((i) => i.name) },
    }
  }
  const inv = cat.investigations.find((i) => i.id === target)
  if (!inv) return null
  const r = ranked.find((x) => x.id === inv.id)!
  return {
    name: inv.name,
    psiId: inv.psiId,
    fuelPhase: inv.fuelPhase,
    hardware: inv.hardware,
    whatWasBurned: inv.fuels,
    oxygenPct: inv.o2Pct,
    pressure: inv.pressure,
    flowCmS: inv.flowCmS,
    tests: inv.tests,
    granularity: inv.granularity,
    rowsInTable: inv.rows,
    rowsWithCleaningFlags: inv.flaggedRows,
    outcomesInTable: inv.outcomeRecorded,
    fireSafetyTheme: inv.safetyTheme,
    factsFromTable: inv.facts.map(factText),
    habitatRelevance: { score: r.score, rank: r.rank, of: ranked.length, criteria: CRITERIA.map((c) => `${c.label}: ${inv.scores[c.key].score} of 2 (${inv.scores[c.key].reason})`) },
    whatWeSimulated: { status: inv.simulation.label, why: inv.simulation.reason },
    papers: inv.sources.filter((s) => s.kind === 'paper').map((s) => (s.kind === 'paper' ? s.title : '')),
  }
}

/** A plain summary built only from the facts, shown when there is no AI answer (or it fails the number check). */
export function psiFallback(cat: PsiCatalogue, target: PsiTarget): string[] | null {
  const ranked = rank(cat.investigations, DEFAULT_WEIGHTS)!
  const invOf = (id: string) => cat.investigations.find((i) => i.id === id)!
  // "13.6-22.2" -> "O2 13.6-22.2%"; "21 (air)" -> "O2 21% (air)".
  const o2 = (s: string) => (s === 'not in table' ? 'oxygen not in the table' : `O2 ${s.replace(/^([\d.]+(?:-[\d.]+)?)/, '$1%')}`)
  if (target === 'overall') {
    const top = ranked.filter((r) => r.rank <= 3)
    const none = cat.investigations.filter((i) => noOutcome(i.outcomeRecorded))
    const allTwo = CRITERIA.filter((c) => top.every((r) => invOf(r.id).scores[c.key].score === 2)).map((c) => c.label)
    const last = ranked[ranked.length - 1]
    const lastZero = CRITERIA.filter((c) => invOf(last.id).scores[c.key].score === 0).map((c) => c.label)
    return [
      `Top of the ranking (equal weights): ${top
        .map((r) => {
          const i = invOf(r.id)
          return `${r.name} ${r.score} (${i.psiId}: ${i.tests > 0 ? `${i.tests} tests` : 'no single tests'}, ${o2(i.o2Pct)}, outcomes ${i.outcomeRecorded})`
        })
        .join('; ')}.`,
      ...(allTwo.length ? [`What separates them: ${top.length === 3 ? 'all three' : 'all of them'} score 2 of 2 on ${andList(allTwo)}.`] : []),
      ...(lastZero.length
        ? [`At the bottom, ${last.name} (${last.score}) scores 0 on ${lastZero.length === CRITERIA.length ? 'every criterion' : andList(lastZero)}.`]
        : []),
      `${none.length} of the ${cat.investigations.length} tables record no outcome per test (${none.map((i) => i.name).join(', ')}), so for them only the conditions can be compared.`,
      'A score is relevance to habitat fire safety, not fire risk.',
    ]
  }
  const inv = cat.investigations.find((i) => i.id === target)
  if (!inv) return null
  const r = ranked.find((x) => x.id === inv.id)!
  return [
    `${inv.name} (${inv.psiId}) burned ${inv.fuels}; oxygen ${inv.o2Pct}, pressure ${inv.pressure}.`,
    ...inv.facts.slice(0, 2).map(factText).map((t) => `${t}.`),
    `Outcomes in the table: ${inv.outcomeRecorded}. Habitat relevance ${r.score} (rank ${r.rank} of ${ranked.length}).`,
    `What we simulated: ${inv.simulation.label}.`,
  ]
}

// ---- The specificity guard: an answer must be about these investigations, not scores in general ----

/** General phrases that say nothing about the data. */
export const VAGUE_PHRASES = [
  /\bhigher scores?\b/i,
  /\bscores? (?:indicate|indicates|suggest|suggests|mean|means|reflect|reflects)\b/i,
  /\bit is important to note\b/i,
  /\bin general\b/i,
  /\bvarious investigations\b/i,
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Does the text name this investigation? "CFI-G (ACME)" also as "CFI-G", "Saffire I-III" also as "Saffire"; "BASS" inside "BASS-II" does not count. */
export function names(text: string, name: string): boolean {
  const forms = new Set([name, name.replace(/\s*\(ACME\)$/, ''), name.replace(/\s+I-III$/, '')])
  return [...forms].some((f) => new RegExp(`(?<![\\w-])${escapeRe(f)}(?![\\w-])`, 'i').test(text))
}

/**
 * Why an AI answer is too general to show, or null if it passes: no vague
 * phrase, and the overall summary names at least three investigations (a
 * card's summary names its own investigation).
 */
export function tooGeneral(answer: string, cat: PsiCatalogue, target: PsiTarget): string | null {
  for (const re of VAGUE_PHRASES) {
    const m = answer.match(re)
    if (m) return `it used a general phrase ("${m[0]}")`
  }
  if (target === 'overall') {
    const named = cat.investigations.filter((i) => names(answer, i.name))
    if (named.length < 3) return `it named ${named.length === 0 ? 'no' : `only ${named.length}`} investigation${named.length === 1 ? '' : 's'}, fewer than three`
    return null
  }
  const inv = cat.investigations.find((i) => i.id === target)
  return inv && !names(answer, inv.name) ? `it did not name ${inv.name}` : null
}

const NUMBER = /\d+(?:\.\d+)?/g

/**
 * Numbers in an AI answer that are not in the facts it was given (the guard
 * against invented numbers). Empty means the answer passes.
 */
export function numbersNotInFacts(answer: string, facts: unknown): string[] {
  const allowed = new Set((JSON.stringify(facts).match(NUMBER) ?? []).map((n) => String(Number(n))))
  const bad = (answer.match(NUMBER) ?? []).map((n) => String(Number(n))).filter((n) => !allowed.has(n))
  return [...new Set(bad)]
}
