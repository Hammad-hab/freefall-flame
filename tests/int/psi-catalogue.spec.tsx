/**
 * The PSI catalogue (investigations/psi.json): it must be exactly what
 * src/scripts/psi-catalogue.ts builds from the cleaned tables in data/psi/,
 * and every card must cite its source. The cards render from it.
 */
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import { build, OUT } from '../../src/scripts/psi-catalogue'
import Investigations from '@/app/(frontend)/dashboard/components/investigations/Investigations'
import { SIM_STATUS, type PsiCatalogue } from '@/lib/psi'

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

  it('says what we simulated and why, for every investigation (the old "simulator" column is gone)', () => {
    const sim = Object.fromEntries(file.investigations.map((i) => [i.name, i.simulation]))
    expect(Object.entries(sim).filter(([, s]) => s.status !== 'none').map(([n, s]) => `${n}: ${s.label}`)).toEqual([
      'BASS-II: Simulated and scored',
      'Saffire I-III: Simulated, compared by hand',
      'CFI-G (ACME): Built, not testable',
    ])
    for (const inv of file.investigations) {
      expect(inv.simulation.label, inv.name).toBe(SIM_STATUS[inv.simulation.status])
      expect(inv.simulation.reason.length, inv.name).toBeGreaterThan(40)
      expect('simulator' in inv, inv.name).toBe(false)
    }
    // BASS-II's numbers come from the scorecard and the cleaned table, not typed in.
    const scorecard = JSON.parse(fs.readFileSync('src/app/(frontend)/dashboard/components/sandbox/scorecard.json', 'utf8'))
    expect(sim['BASS-II'].reason).toContain(`129 presets. NASA states an outcome for ${scorecard.scored} of them`)
    expect(sim['BASS-II'].reason).toContain(`${scorecard.matched} match (${scorecard.matchedTests.join(', ')})`)
    expect(sim['Saffire I-III'].reason).toContain('0 of 6 reproduce them')
    expect(sim['Saffire I-III'].reason).toContain('The 4 silicone samples (Saffire-II) are skipped')
    expect(sim['CFI-G (ACME)'].reason).toContain('A radiation audit ruled radiation out as the cause')
    expect(sim.SPICE.reason).toContain('not the smoke points')
    expect(sim.BASS.reason).toContain('no oxygen, airflow or outcome')
    expect(JSON.stringify(file)).not.toMatch(/"planned/)
  })

  it('renders one card per investigation, and each card\'s details show its sources', () => {
    render(<Investigations />)
    const cards = document.querySelectorAll('[data-psi]')
    expect(cards).toHaveLength(14)
    // The compact cards open their full card (with the sources) in the Details side panel.
    for (const inv of file.investigations) {
      fireEvent.click(document.querySelector(`[data-details="${inv.id}"]`)!)
      const panel = document.querySelector(`[data-psi-detail="${inv.id}"]`) as HTMLElement
      expect(panel, inv.name).toBeTruthy()
      expect(within(panel).getByText(`NASA PSI table ${inv.psiId}`), inv.name).toBeTruthy()
      if (inv.id === 'bass-ii') expect(within(panel).getByText('Burning and Suppression of Solids–II (BASS-II) Summary Report')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: `Close the details of ${inv.name}` }))
      expect(document.querySelector('[data-psi-detail]')).toBeNull()
    }
  }, 30_000) // 14 side panels opened and closed in jsdom
})
