/**
 * The PSI summaries' grounding (src/lib/psi-ai.ts): what the model is sent,
 * the plain summary, and the check that rejects any AI answer with a number
 * not in the facts. No network: the route's model call is not exercised here.
 */
import { describe, it, expect } from 'vitest'
import data from '@/app/(frontend)/dashboard/components/investigations/psi.json'
import type { PsiCatalogue } from '@/lib/psi'
import { PSI_OVERALL_SYSTEM, PSI_SYSTEM, names, numbersNotInFacts, psiFacts, psiFallback, systemFor, tooGeneral } from '@/lib/psi-ai'

const cat = data as PsiCatalogue
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
    expect(top).toMatchObject({ name: 'BASS-II', score: 90, tests: 129, oxygenPct: '13.6-22.2', outcomesInTable: 'partial (26 of 129)' })
    expect(top.criterionScores).toEqual({ 'Habitat materials': 2, 'Habitat atmosphere': 1, 'Cabin airflow': 2, 'Data richness': 2, 'Informs a fire-safety decision': 2 })
    expect(String(top.whatWeSimulated)).toMatch(/^Simulated and scored: /)
    expect((overall.tablesWithNoOutcomePerTest as { count: number; names: string[] }).names).toContain('BASS')
    expect(psiFacts(cat, 'cfi-g')!.whatWeSimulated).toMatchObject({ status: 'Built, not testable' })
  })

  it('makes the plain overall summary specific: the top three with a fact each, and the tables without outcomes', () => {
    const lines = psiFallback(cat, 'overall')!
    expect(lines[0]).toBe(
      'Top of the ranking (equal weights): BASS-II 90 (PSI-25: 129 tests, O2 13.6-22.2%, outcomes partial (26 of 129)); ' +
        'Saffire I-III 80 (PSI-98/99/100: 13 tests, O2 21.5-22.1%, outcomes yes (burn time, spread; II also 1-g comparison)); ' +
        'SAME-R 80 (PSI-101: 109 tests, O2 21% (air), outcomes no (smoke measurements not in table)).',
    )
    expect(lines[1]).toBe('What separates them: all three score 2 of 2 on Habitat materials, Cabin airflow and Informs a fire-safety decision.')
    expect(lines[2]).toBe('At the bottom, CLD Flame (ACME) (0) scores 0 on every criterion.')
    expect(lines.join(' ')).toMatch(/10 of the 14 tables record no outcome per test \(BASS, /)
    expect(tooGeneral(lines.join(' '), cat, 'overall')).toBeNull()
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

  it('rejects an AI answer with a number not in the facts, and accepts one without', () => {
    const facts = psiFacts(cat, 'flex')!
    expect(numbersNotInFacts('Of 274 droplets, 186 went out with fuel left (extinction).', facts)).toEqual([])
    expect(numbersNotInFacts('About 68% of droplets went out.', facts)).toEqual(['68'])
    expect(numbersNotInFacts('Burn times reached 45 s.', facts)).toEqual(['45'])
  })
})
