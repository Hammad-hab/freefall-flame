/**
 * The PSI summaries' grounding (src/lib/psi-ai.ts): what the model is sent,
 * the plain summary, and the check that rejects any AI answer with a number
 * not in the facts. No network: the route's model call is not exercised here.
 */
import { describe, it, expect } from 'vitest'
import data from '@/app/(frontend)/dashboard/components/investigations/psi.json'
import type { PsiCatalogue } from '@/lib/psi'
import { numbersNotInFacts, psiFacts, psiFallback } from '@/lib/psi-ai'

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

  it('rejects an AI answer with a number not in the facts, and accepts one without', () => {
    const facts = psiFacts(cat, 'flex')!
    expect(numbersNotInFacts('Of 274 droplets, 186 went out with fuel left (extinction).', facts)).toEqual([])
    expect(numbersNotInFacts('About 68% of droplets went out.', facts)).toEqual(['68'])
    expect(numbersNotInFacts('Burn times reached 45 s.', facts)).toEqual(['45'])
  })
})
