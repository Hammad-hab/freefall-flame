/**
 * The PSI catalogue (investigations/psi.json): it must be exactly what
 * src/scripts/psi-catalogue.ts builds from the cleaned tables in data/psi/,
 * and every card must cite its source. The cards render from it.
 */
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import { render, screen, cleanup, within } from '@testing-library/react'
import { build, OUT } from '../../src/scripts/psi-catalogue'
import Investigations from '@/app/(frontend)/dashboard/components/investigations/Investigations'
import type { PsiCatalogue } from '@/lib/psi'

afterEach(cleanup)

const file = JSON.parse(fs.readFileSync(OUT, 'utf8')) as PsiCatalogue

describe('PSI catalogue', () => {
  it('is exactly what the script builds from data/psi/ (rerun the script if this fails)', () => {
    expect(file).toEqual(build())
  })

  it('has the 14 investigations, each citing its PSI id', () => {
    expect(file.investigations).toHaveLength(14)
    for (const inv of file.investigations) {
      expect(inv.sources[0], inv.name).toEqual({ kind: 'psi', psiId: inv.psiId, table: inv.cleanedFile })
      expect(inv.psiId, inv.name).toMatch(/^PSI-\d+/)
    }
  })

  it('cites papers only where they are hand-checked: the two BASS-II NTRS papers', () => {
    const papers = file.investigations.flatMap((i) => i.sources.filter((s) => s.kind === 'paper').map((s) => [i.name, s]))
    expect(papers.map(([n]) => n)).toEqual(['BASS-II', 'BASS-II'])
    expect(papers.map(([, s]) => (s as { ntrsId: string }).ntrsId)).toEqual(['20210011385', '20150019858'])
  })

  it('counts outcomes from the cleaned tables', () => {
    const facts = (name: string) => file.investigations.find((i) => i.name === name)!.facts
    const count = (name: string, label: string) => {
      const f = facts(name).find((x) => x.label === label)
      return f && f.kind === 'count' ? Object.fromEntries(f.items.map((i) => [i.value, i.count])) : null
    }
    expect(count('BASS-II', "NASA's stated outcome")).toEqual({
      'not stated': 103, 'extinguished low flow': 17, 'blowoff high flow': 7, 'no ignition': 1, 'not sustained': 1,
    })
    expect(count('FLEX', 'Outcome')).toEqual({ extinction: 186, disruption: 61, completion: 27 })
    expect(count('CFI-G (ACME)', 'Outcome, normal flames at 30% O2 or more')).toEqual({
      'self extinguished': 61, 'flow terminated': 30, 'no ignition': 24,
    })
  })

  it('renders one card per investigation, with its sources', () => {
    render(<Investigations />)
    const cards = document.querySelectorAll('[data-psi]')
    expect(cards).toHaveLength(14)
    const bass2 = document.querySelector('[data-psi="bass-ii"]') as HTMLElement
    expect(within(bass2).getByText('Burning and Suppression of Solids–II (BASS-II) Summary Report')).toBeTruthy()
    expect(screen.getAllByText(/^NASA PSI table PSI-/)).toHaveLength(14)
  })
})
