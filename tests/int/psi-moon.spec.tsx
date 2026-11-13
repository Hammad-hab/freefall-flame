/**
 * The Moon-base scenario card (an extrapolation): its numbers come from the
 * cleaned tables (psi.json's moonBase, built by src/scripts/psi-catalogue.ts),
 * and it says what the data can't support before anything else.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import data from '@/app/(frontend)/dashboard/components/investigations/psi.json'
import MoonBaseCard from '@/app/(frontend)/dashboard/components/investigations/MoonBaseCard'
import { moonHref } from '@/app/(frontend)/dashboard/components/workspace/links'
import type { PsiCatalogue } from '@/lib/psi'

afterEach(cleanup)
const moon = (data as PsiCatalogue).moonBase

describe('Moon-base scenario card', () => {
  it('uses 34% O2 and 0.17 g, and the highest solid-test oxygen from the tables', () => {
    expect([moon.o2Pct, moon.gravityG]).toEqual([34, 0.17])
    expect(moon.solidMaxO2Pct).toBe(22.2)
    expect(moon.saffireMaxO2Pct).toBe(22.1)
  })

  it('counts the tests at 30% O2 or more', () => {
    const row = (name: string) => moon.near.find((n) => n.investigation === name)!
    expect(row('CFI-G (ACME)')).toMatchObject({ atLeast30: 115, lowPressure: 20 })
    expect(row('CFI-G (ACME)').outcomes).toEqual([
      { value: 'self extinguished', count: 61 }, { value: 'flow terminated', count: 30 }, { value: 'no ignition', count: 24 },
    ])
    expect(row('FLEX')).toMatchObject({ atLeast30: 24, at34: 9, lowPressure: 0 })
    expect(row('BRE (ACME)')).toMatchObject({ atLeast30: 17, at34: 13, lowPressure: null, unit: 'test days' })
  })

  it('says first that no solid test exceeds 22.2% O2 and that pressure is not modelled, and is labelled an extrapolation', () => {
    render(<MoonBaseCard moon={moon} />)
    const limits = [...document.querySelectorAll('#psi-moon-limits li')].map((li) => li.textContent)
    expect(limits[0]).toContain('No solid-material test in these tables goes above 22.2% O2')
    expect(limits[1]).toContain("Pressure isn't modelled")
    expect(document.querySelector('#psi-moon')?.textContent).toContain(
      'extrapolation: not validated above 22.2% O2; pressure is not modelled (the engine runs at 1 atm).',
    )
  })

  it('states the what-if result plainly: fully consumed, not "burned out"', () => {
    render(<MoonBaseCard moon={moon} />)
    const text = document.querySelector('[data-moon-result]')?.textContent?.replace(/\s+/g, ' ').trim()
    expect(text).toBe(
      "At 34% O2 and 0.17 g, the sample was fully consumed by step 1271; at NASA's conditions (B1) it is still burning at step 1500. More oxygen made the fire faster, not safer.",
    )
    expect(document.querySelector('#psi-moon')?.textContent).not.toMatch(/burned out/)
  })

  it('links to the sandbox what-if', () => {
    expect(moonHref()).toBe('/dashboard?tab=sandbox&scenario=moon')
  })
})
