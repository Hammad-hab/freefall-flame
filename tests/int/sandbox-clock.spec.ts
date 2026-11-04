import { describe, expect, it } from 'vitest'
import {
  MAX_STEPS_PER_FRAME,
  STEPS_PER_SECOND,
  StepClock,
} from '@/app/(frontend)/dashboard/components/sandbox/engine/clock'
import { fitCell } from '@/app/(frontend)/dashboard/components/sandbox/view/fit'
import { matchVerdict } from '@/app/(frontend)/dashboard/components/sandbox/engine/scoring'
import { NASA, OUTCOME } from '@/app/(frontend)/dashboard/components/sandbox/engine/Engine'

/** Run a clock at `hz` frames per second for `seconds`; return the total steps. */
function run(hz: number, seconds: number, speed: number, limit = Infinity): { steps: number; behind: boolean } {
  const clock = new StepClock()
  let steps = 0
  let behind = false
  const frames = Math.round(hz * seconds)
  for (let f = 0; f <= frames; f++) {
    steps += clock.advance((f * 1000) / hz, speed, limit - steps)
    behind ||= clock.behind
  }
  return { steps, behind }
}

describe('StepClock (fixed timestep)', () => {
  it(`runs ${STEPS_PER_SECOND} steps per second at 1x on a 60 Hz and a 144 Hz screen`, () => {
    expect(run(60, 10, 1).steps).toBe(600)
    expect(run(144, 10, 1).steps).toBe(600)
    expect(run(75, 10, 1).steps).toBe(600)
  })

  it('multiplies by the speed setting, the same at any refresh rate', () => {
    for (const speed of [2, 4]) {
      expect(run(60, 10, speed).steps).toBe(600 * speed)
      expect(run(144, 10, speed).steps).toBe(600 * speed)
    }
  })

  it(`never runs more than ${MAX_STEPS_PER_FRAME} steps in a frame, and says it is behind`, () => {
    const slow = run(5, 2, 8) // 5 frames a second at 8x would owe 96 steps a frame
    expect(slow.behind).toBe(true)
    expect(slow.steps).toBe(10 * MAX_STEPS_PER_FRAME)
    expect(run(144, 2, 1).behind).toBe(false)
  })

  it('stops exactly at the limit (the end of a timeline)', () => {
    expect(run(60, 100, 4, 4500).steps).toBe(4500)
    expect(run(144, 100, 8, 1500).steps).toBe(1500)
  })

  it('does not catch up time spent paused', () => {
    const clock = new StepClock()
    clock.advance(0, 1)
    expect(clock.advance(1000 / 60, 1)).toBe(1)
    clock.reset() // paused here for 10 s
    expect(clock.advance(11_000, 1)).toBe(0) // the first frame after play only starts the clock
    expect(clock.advance(11_000 + 1000 / 60, 1)).toBe(1)
  })
})

describe('fitCell', () => {
  it('fits 200 x 150 cells into the space and keeps the shape', () => {
    expect(fitCell(800, 600, 200, 150, 1)).toBe(4)
    expect(fitCell(1000, 600, 200, 150, 1)).toBe(4) // height limits
    expect(fitCell(1000, 1000, 200, 150, 1)).toBe(5) // width limits
  })
  it('uses whole device pixels per cell when there are at least 2', () => {
    expect(fitCell(1050, 1000, 200, 150, 1)).toBe(5) // 5.25 css px -> 5
    expect(fitCell(1050, 1000, 200, 150, 2)).toBe(5) // 10.5 device px -> 10 -> 5 css px
    expect(fitCell(1050, 1000, 200, 150, 1.5)).toBeCloseTo(7 / 1.5, 10) // 7.875 device px -> 7
  })
  it('falls back to the exact fit below 2 device pixels per cell', () => {
    expect(fitCell(300, 300, 200, 150, 1)).toBe(1.5)
  })
})

describe('matchVerdict', () => {
  it('scores like flame-core', () => {
    expect(matchVerdict(NASA.WENT_OUT_LOW_FLOW, OUTCOME.OUT_LOW_FLOW, false)).toBe('match')
    expect(matchVerdict(NASA.WENT_OUT_LOW_FLOW, OUTCOME.BURNED_OUT, true)).toBe('no match')
    expect(matchVerdict(NASA.WENT_OUT_LOW_FLOW, OUTCOME.BURNING, false)).toBe('pending')
    expect(matchVerdict(NASA.WENT_OUT_LOW_FLOW, OUTCOME.BURNING, true)).toBe('no match')
    expect(matchVerdict(NASA.NOT_STATED, OUTCOME.BURNED_OUT, true)).toBe('not scored')
    expect(matchVerdict(NASA.NOT_SUSTAINED, OUTCOME.OUT_STEADY_FLOW, true)).toBe('match')
  })
})
