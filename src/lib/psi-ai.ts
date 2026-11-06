/**
 * What the AI is told about the PSI catalogue, the plain summary shown when
 * there is no AI answer, and the number check every AI answer must pass.
 * Pure functions: no React, no network.
 */
import { CRITERIA, DEFAULT_WEIGHTS, rank, type PsiCatalogue, type PsiFact } from './psi'

export const PSI_SYSTEM = [
  'You summarise NASA combustion investigations for a crew-habitat fire-safety dashboard.',
  'STRICT RULES:',
  '1. Use ONLY the facts JSON in the user message. Never invent measurements, test counts, results or papers.',
  '2. Every number you write must appear in the facts JSON exactly as given. Do not round, convert or compute new numbers.',
  '3. Say what the table does not hold (for example outcomes) when the facts say so.',
  '4. The relevance score is how directly the data speaks to habitat fire safety. It is NOT fire risk. Never call a material or investigation safe, unsafe, high-risk or low-risk.',
  '5. Label interpretations as interpretations.',
  '6. Cite only the PSI id and the paper titles in the facts.',
  '7. Under 120 words, structured as: What the data shows / What it may mean for habitats / What remains uncertain.',
].join('\n')

export type PsiTarget = 'overall' | string

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
    return {
      what: 'ranking of NASA PSI combustion investigations by relevance to crew-habitat fire safety, equal weights',
      formula: 'score = sum(weight x criterion) / (2 x sum(weights)) x 100; each criterion 0, 1 or 2; all weights 1',
      criteria: CRITERIA.map((c) => `${c.label}${'judgement' in c && c.judgement ? ' (our judgement)' : ''}: ${c.help}`),
      habitatReference: [cat.reference.iss.text, cat.reference.exploration.text, cat.reference.ventilation.text],
      ranking: ranked.map((r) => {
        const inv = cat.investigations.find((i) => i.id === r.id)!
        return { rank: r.rank, name: r.name, psiId: inv.psiId, score: r.score, outcomesInTable: inv.outcomeRecorded }
      }),
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
    papers: inv.sources.filter((s) => s.kind === 'paper').map((s) => (s.kind === 'paper' ? s.title : '')),
  }
}

/** A plain summary built only from the facts, shown when there is no AI answer (or it fails the number check). */
export function psiFallback(cat: PsiCatalogue, target: PsiTarget): string[] | null {
  const ranked = rank(cat.investigations, DEFAULT_WEIGHTS)!
  if (target === 'overall') {
    const top = ranked.filter((r) => r.rank <= 3)
    const none = cat.investigations.filter((i) => /^no/.test(i.outcomeRecorded) || /per day only/.test(i.outcomeRecorded)).length
    return [
      `With equal weights the most habitat-relevant tables are ${top.map((r) => `${r.name} (${r.score})`).join(', ')}.`,
      `${none} of the ${cat.investigations.length} tables record no outcome per test, so for them only the conditions can be compared.`,
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
  ]
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
