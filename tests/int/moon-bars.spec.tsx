/**
 * feat/ui-visuals: the Moon-base what-if ends on a comparison, not an empty
 * grid: B1 at NASA's conditions (the measured result the Moon-base card
 * states) against the what-if (the live run), as two bars on one step axis.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MoonBars } from '@/app/(frontend)/dashboard/components/sandbox/view/PresetsPanel'
import { MOON_RESULT } from '@/app/(frontend)/dashboard/components/investigations/MoonBaseCard'

afterEach(cleanup)

const bar = (key: string) => document.querySelector(`[data-moon-bar="${key}"]`) as HTMLElement
const width = (key: string) => (bar(key).querySelector('span.block') as HTMLElement).style.width

describe('Moon-base comparison bars', () => {
  it('ends with B1 still burning at 1500 and the what-if consumed at its step', () => {
    render(<MoonBars step={1500} runSteps={1500} consumedStep={MOON_RESULT.consumedByStep} finished />)
    expect(bar('nasa').getAttribute('data-step')).toBe(String(MOON_RESULT.nasaStillBurningAt))
    expect(bar('nasa').textContent).toContain(`still burning at step ${MOON_RESULT.nasaStillBurningAt}`)
    expect(width('nasa')).toBe('100%')
    expect(bar('whatif').getAttribute('data-step')).toBe(String(MOON_RESULT.consumedByStep))
    expect(bar('whatif').textContent).toContain(`fully consumed by step ${MOON_RESULT.consumedByStep}`)
    expect(width('whatif')).toBe(`${(100 * MOON_RESULT.consumedByStep) / 1500}%`)
  })

  it('grows with the live run before the sample is used up', () => {
    render(<MoonBars step={600} runSteps={1500} consumedStep={null} finished={false} />)
    expect(width('whatif')).toBe('40%')
    expect(bar('whatif').textContent).toContain('step 600 of 1500')
  })
})
