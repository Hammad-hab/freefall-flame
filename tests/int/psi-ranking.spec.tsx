/**
 * The habitat fire-safety ranking: the scores and reasons in psi.json (built
 * by src/scripts/psi-catalogue.ts; psi-catalogue.spec.tsx checks the file
 * equals the script), the weighting rule, and the sliders on screen.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import data from '@/app/(frontend)/dashboard/components/investigations/psi.json'
import Investigations from '@/app/(frontend)/dashboard/components/investigations/Investigations'
import { CRITERIA, DEFAULT_WEIGHTS, HABITAT_REFERENCE, rank, type PsiCatalogue, type Weights } from '@/lib/psi'

afterEach(cleanup)
const catalogue = data as PsiCatalogue
const only = (key: keyof Weights): Weights => ({ materials: 0, atmosphere: 0, airflow: 0, richness: 0, decision: 0, [key]: 1 })

describe('habitat ranking', () => {
  it('uses the stated reference values, with their sources', () => {
    expect(catalogue.reference).toEqual(HABITAT_REFERENCE)
    expect(HABITAT_REFERENCE.iss.text).toBe('about 21% O2 at 1 atm (14.7 psia)')
    expect(HABITAT_REFERENCE.exploration.text).toContain('8.0 psia / 32%')
    expect(HABITAT_REFERENCE.exploration.text).toContain('8.2 psia / 34%')
    expect(HABITAT_REFERENCE.exploration.source).toContain('NTRS 20130013505')
    expect([HABITAT_REFERENCE.exploration.minO2Pct, HABITAT_REFERENCE.exploration.maxPressureAtm]).toEqual([30, 0.7])
    expect(HABITAT_REFERENCE.ventilation.cmS).toEqual([7.6, 20])
    expect(HABITAT_REFERENCE.ventilation.source).toBe('SAE 932191')
  })

  it('gives every investigation five criteria, each 0-2 with a reason; e is labelled our judgement', () => {
    for (const inv of catalogue.investigations) {
      for (const c of CRITERIA) {
        const s = inv.scores[c.key]
        expect([0, 1, 2], `${inv.name} ${c.key}`).toContain(s.score)
        expect(s.reason.length, `${inv.name} ${c.key}`).toBeGreaterThan(10)
      }
    }
    expect(CRITERIA.filter((c) => 'judgement' in c && c.judgement).map((c) => c.key)).toEqual(['decision'])
  })

  it('ranks with equal weights as the scores say', () => {
    const r = rank(catalogue.investigations, DEFAULT_WEIGHTS)!
    expect(r.map((x) => `${x.rank} ${x.name} ${x.score}`)).toEqual([
      '1 BASS-II 90',
      '2 Saffire I-III 80',
      '2 SAME-R 80',
      '4 FLEX 70',
      '4 SAME 70',
      '6 CFI-G (ACME) 60',
      '7 SPICE 50',
      '8 BASS 40',
      '8 BRE (ACME) 40',
      '10 CFI 30',
      '10 Flame Design (ACME) 30',
      '10 FLEX-2 30',
      '13 s-Flame (ACME) 20',
      '14 CLD Flame (ACME) 0',
    ])
  })

  it('reweights: one criterion alone, and all weights 0', () => {
    const atm = rank(catalogue.investigations, only('atmosphere'))!
    expect(atm.filter((x) => x.score === 100).map((x) => x.name)).toEqual([
      'CFI', 'CFI-G (ACME)', 'Flame Design (ACME)', 'FLEX', 'FLEX-2', 's-Flame (ACME)',
    ])
    expect(rank(catalogue.investigations, { materials: 0, atmosphere: 0, airflow: 0, richness: 0, decision: 0 })).toBeNull()
  })

  it('updates the ranking on screen when a weight slider moves', () => {
    render(<Investigations />)
    const first = () => document.querySelector('[data-rank-id]')?.getAttribute('data-rank-id')
    expect(first()).toBe('bass-ii')
    for (const c of CRITERIA) {
      fireEvent.change(document.querySelector(`input[data-weight="${c.key}"]`)!, { target: { value: c.key === 'atmosphere' ? '3' : '0' } })
    }
    expect(first()).toBe('cfi')
    expect(document.querySelector('[data-rank-id="bass-ii"] [data-score]')?.textContent).toBe('50')
    for (const c of CRITERIA) fireEvent.change(document.querySelector(`input[data-weight="${c.key}"]`)!, { target: { value: '0' } })
    expect(document.querySelector('#psi-ranking')?.textContent).toContain('Every weight is 0')
  })
})
