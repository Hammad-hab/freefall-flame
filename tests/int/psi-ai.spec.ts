/**
 * The PSI summaries' grounding (src/lib/psi-ai.ts): what the model is sent,
 * the plain summary, and the check that rejects any AI answer with a number
 * not in the facts. No network: the route's model call is not exercised here.
 */
import { describe, it, expect } from 'vitest'
import data from '@/app/(frontend)/dashboard/components/investigations/psi.json'
import type { PsiCatalogue } from '@/lib/psi'
import { PSI_OVERALL_SYSTEM, PSI_SYSTEM, names, numbersNotInFacts, o2Text, psiFacts, psiFallback, systemFor, tooGeneral, unmarkedInterpretation } from '@/lib/psi-ai'

const cat = data as PsiCatalogue

/** The overall answer from the feat/psi-widgets proof call, word for word (exported for the route test). */
export const PROOF_ANSWER = `### Top of the ranking
1. **BASS-II** (PSI-25): 129 tests, partial outcomes for 26 of 129.
2. **Saffire I-III** (PSI-98/99/100): 13 tests, outcomes recorded as burn time, spread.
2. **SAME-R** (PSI-101): 109 tests, outcomes not recorded in table.

### What separates them
The top three investigations hold high scores in habitat materials and cabin airflow (2 points), while those ranked lower lack either robust test counts or outcomes.

### What the tables can't tell us
10 tables recorded no outcomes per test, including "BASS," "SAME," and "SPICE."`
const targets = ['overall', ...cat.investigations.map((i) => i.id)]

describe('PSI summaries', () => {
  it('sends the model only that card, or the ranking at equal weights', () => {
    const flex = psiFacts(cat, 'flex')!
    expect(flex.name).toBe('FLEX')
    expect(flex.psiId).toBe('PSI-69')
    expect(flex.factsFromTable).toContain('Outcome: extinction 186, disruption 61, completion 27')
    expect(JSON.stringify(flex)).not.toContain('BASS-II')
    const overall = psiFacts(cat, 'overall')!
    expect((overall.ranking as { name: string; score: number }[])[0]).toMatchObject({ name: 'BASS-II', score: 90 })
    expect(psiFacts(cat, 'no-such-test')).toBeNull()
  })

  it('cites papers only from the catalogue: BASS-II has its two, the others none', () => {
    expect((psiFacts(cat, 'bass-ii')!.papers as string[]).length).toBe(2)
    expect(psiFacts(cat, 'flex')!.papers).toEqual([])
  })

  it('builds every plain summary from its facts alone (it passes the number check itself)', () => {
    for (const t of targets) {
      const lines = psiFallback(cat, t)!
      expect(lines.length, t).toBeGreaterThan(1)
      expect(numbersNotInFacts(lines.join(' '), psiFacts(cat, t)), t).toEqual([])
    }
  })

  it('gives the overall summary its own rules: name investigations and facts, no general statements', () => {
    expect(systemFor('overall')).toBe(PSI_OVERALL_SYSTEM)
    expect(systemFor('flex')).toBe(PSI_SYSTEM)
    expect(PSI_OVERALL_SYSTEM).toContain('Name at least three investigations')
    expect(PSI_OVERALL_SYSTEM).toContain('Do not write general statements about scoring, such as "higher scores indicate"')
    expect(PSI_OVERALL_SYSTEM).toContain("Top of the ranking / What separates them / What the tables can't tell us")
    // Both keep the shared rules (the number rule among them).
    for (const s of [PSI_SYSTEM, PSI_OVERALL_SYSTEM]) expect(s).toContain('Every number you write must appear in the facts JSON exactly as given')
  })

  it('sends the overall summary each investigation\'s facts, criterion scores and what we simulated', () => {
    const overall = psiFacts(cat, 'overall')!
    const top = (overall.ranking as Record<string, unknown>[])[0]
    expect(top).toMatchObject({ rank: '1', name: 'BASS-II', score: 90, tests: 129, oxygen: '13.6-22.2%', outcomesInTable: 'partial (26 of 129)' })
    expect(top.criterionScores).toEqual({ 'Habitat materials': 2, 'Habitat atmosphere': 1, 'Cabin airflow': 2, 'Data richness': 2, 'Informs a fire-safety decision': 2 })
    expect(String(top.whatWeSimulated)).toMatch(/^Simulated and scored: /)
    expect((overall.tablesWithNoOutcomePerTest as { count: number; names: string[] }).names).toContain('BASS')
    expect(psiFacts(cat, 'cfi-g')!.whatWeSimulated).toMatchObject({ status: 'Built, not testable' })
  })

  it('makes the plain overall summary specific: the top three with a fact each, and the tables without outcomes', () => {
    const lines = psiFallback(cat, 'overall')!
    expect(lines[0]).toBe(
      'Top of the ranking (equal weights): rank 1: BASS-II 90 (PSI-25: 129 tests, O2 13.6-22.2%, outcomes partial (26 of 129)); ' +
        'rank 2=: Saffire I-III 80 (PSI-98/99/100: 13 tests, O2 21.5-22.1%, outcomes yes (burn time, spread; II also 1-g comparison)); ' +
        'rank 2=: SAME-R 80 (PSI-101: 109 tests, O2 21% air, outcomes no (smoke measurements not in table)).',
    )
    expect(lines[1]).toBe('What separates them: all three score 2 of 2 on Habitat materials, Cabin airflow and Informs a fire-safety decision.')
    expect(lines[2]).toBe('At the bottom, CLD Flame (ACME) (0) scores 0 on every criterion.')
    expect(lines.join(' ')).toMatch(/10 of the 14 tables record no outcome per test \(BASS, /)
    expect(tooGeneral(lines.join(' '), cat, 'overall')).toBeNull()
  })

  it('writes oxygen with its unit and tied ranks as "2=", in the facts, the prompt and the plain summaries', () => {
    expect(o2Text('13.6-22.2')).toBe('13.6-22.2%')
    expect(o2Text('21 (air)')).toBe('21% air')
    expect(o2Text('12-85')).toBe('12-85%')
    expect(o2Text('not in table')).toBe('not in the table')
    const ranking = psiFacts(cat, 'overall')!.ranking as { name: string; rank: string; oxygen: string }[]
    const by = Object.fromEntries(ranking.map((r) => [r.name, r]))
    expect([by['BASS-II'].rank, by['Saffire I-III'].rank, by['SAME-R'].rank, by.FLEX.rank, by.SAME.rank, by['CFI-G (ACME)'].rank]).toEqual(['1', '2=', '2=', '4=', '4=', '6'])
    expect(by['SAME-R'].oxygen).toBe('21% air')
    expect(by.BASS.oxygen).toBe('not in the table')
    expect(JSON.stringify(psiFacts(cat, 'overall'))).not.toContain('oxygenPct')
    expect(psiFacts(cat, 'same-r')).toMatchObject({ oxygen: '21% air', habitatRelevance: { rank: '2=', of: 14 } })
    expect(psiFallback(cat, 'same-r')!.join(' ')).toContain('oxygen 21% air')
    expect(psiFallback(cat, 'same-r')!.join(' ')).toContain('Habitat relevance 80 (rank 2= of 14)')
    expect(psiFallback(cat, 'bass-ii')!.join(' ')).toContain('(rank 1 of 14)')
    for (const s of [PSI_SYSTEM, PSI_OVERALL_SYSTEM]) expect(s).toContain('Write oxygen with its unit as the facts give it (for example 21% air), and a tied rank as the facts give it (2=).')
  })

  it('specificity guard: rejects a vague answer or one naming fewer than three investigations', () => {
    const vague = 'What the data shows: Higher scores indicate investigations directly informing fire safety decisions.'
    expect(tooGeneral(vague, cat, 'overall')).toBe('it used a general phrase ("Higher scores")')
    expect(tooGeneral('BASS-II leads; FLEX follows.', cat, 'overall')).toBe('it named only 2 investigations, fewer than three')
    expect(tooGeneral('Nothing is named here.', cat, 'overall')).toBe('it named no investigations, fewer than three')
    expect(tooGeneral('BASS-II (129 tests), Saffire (13 tests) and CFI-G lead; SAME-R records no smoke data.', cat, 'overall')).toBeNull()
    // "BASS" inside "BASS-II", "FLEX" inside "FLEX-2" and "SAME" inside "SAME-R" are not separate mentions.
    expect(names('BASS-II only', 'BASS')).toBe(false)
    expect(names('FLEX-2 only', 'FLEX')).toBe(false)
    expect(names('SAME-R only', 'SAME')).toBe(false)
    expect(names('the CFI-G tests', 'CFI-G (ACME)')).toBe(true)
    // A card's summary must name its own investigation.
    expect(tooGeneral('These droplets burned in still air.', cat, 'flex')).toBe('it did not name FLEX')
    expect(tooGeneral('FLEX burned methanol and heptane droplets.', cat, 'flex')).toBeNull()
  })

  it('rule 12: interpretation only under "What separates them" or after a marker such as "This suggests"', () => {
    expect(PSI_OVERALL_SYSTEM).toContain('12. Anything that interprets rather than states a fact goes under "What separates them", or starts with "This suggests"')
    // The real answer from the proof call (8 Nov 2026), word for word: its one interpretation is under "What separates them".
    expect(unmarkedInterpretation(PROOF_ANSWER)).toBeNull()
    // The same interpretation moved under "Top of the ranking", unmarked: caught.
    const moved = PROOF_ANSWER.replace(
      '2. **SAME-R** (PSI-101): 109 tests, outcomes not recorded in table.',
      '2. **SAME-R** (PSI-101): 109 tests, outcomes not recorded in table. Its smoke data may matter most for detectors.',
    )
    expect(unmarkedInterpretation(moved)).toBe('Its smoke data may matter most for detectors.')
    // Starting with the marker makes it allowed there.
    expect(unmarkedInterpretation(moved.replace('Its smoke data may matter', 'This suggests its smoke data may matter'))).toBeNull()
    // Under the last heading (curly apostrophe as models often write it), unmarked: caught.
    const last = 'Top of the ranking: BASS-II 90.\nWhat separates them: materials.\nWhat the tables can’t tell us: 10 tables have no outcomes, which likely hides failures.'
    expect(unmarkedInterpretation(last)).toBe('10 tables have no outcomes, which likely hides failures.')
    // A plain statement of fact is never caught, and neither is the plain summary.
    expect(unmarkedInterpretation('What the tables can\'t tell us: 10 of the 14 tables record no outcome per test.')).toBeNull()
    expect(unmarkedInterpretation(psiFallback(cat, 'overall')!.join('\n'))).toBeNull()
  })

  it('rejects an AI answer with a number not in the facts, and accepts one without', () => {
    const facts = psiFacts(cat, 'flex')!
    expect(numbersNotInFacts('Of 274 droplets, 186 went out with fuel left (extinction).', facts)).toEqual([])
    expect(numbersNotInFacts('About 68% of droplets went out.', facts)).toEqual(['68'])
    expect(numbersNotInFacts('Burn times reached 45 s.', facts)).toEqual(['45'])
  })
})
