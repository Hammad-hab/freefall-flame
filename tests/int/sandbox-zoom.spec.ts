/**
 * feat/ui-visuals: the sandbox's display zoom, centred on the sample
 * (view/fit.ts). The mouse is read against the canvas's real rectangle, so
 * only the centring is computed here; run-checks paints at 3x and reads
 * the cell back.
 */
import { describe, it, expect } from 'vitest'
import { ZOOMS, sampleCentre, zoomOffset } from '@/app/(frontend)/dashboard/components/sandbox/view/fit'

const COLS = 200, ROWS = 150

describe('sandbox zoom', () => {
  it('offers 1x, 2x and 3x', () => {
    expect([...ZOOMS]).toEqual([1, 2, 3])
  })

  it('finds the middle of the sample from its fuel cells, or the chamber centre when there is none', () => {
    const fuel = new Float32Array(COLS * ROWS)
    expect(sampleCentre(fuel, COLS, ROWS)).toEqual({ x: 100, y: 75 })
    // A bar: x 60..109 on row 74 (like a BASS-II bar).
    for (let x = 60; x <= 109; x++) fuel[74 * COLS + x] = 1
    expect(sampleCentre(fuel, COLS, ROWS)).toEqual({ x: 85, y: 74.5 })
    // With the temperature, the fire counts too: a hot plume x 110..149, rows 70..79.
    const temp = new Float32Array(COLS * ROWS).fill(300)
    for (let y = 70; y <= 79; y++) for (let x = 110; x <= 149; x++) temp[y * COLS + x] = 900
    temp[75 * COLS + 150] = 400 // not over 400 K: not part of the fire
    expect(sampleCentre(fuel, COLS, ROWS, temp)).toEqual({ x: 105, y: 75 })
  })

  it('puts the focus cell in the middle of the box, never past the chamber edges', () => {
    const cell = 4 // box 800 x 600 px
    // At 1x nothing moves.
    expect(zoomOffset({ x: 85, y: 74.5 }, 1, cell, COLS, ROWS)).toEqual({ left: 0, top: 0 })
    // At 3x, focus (85, 74.5) -> px (1020, 894); the box centre is (400, 300).
    expect(zoomOffset({ x: 85, y: 74.5 }, 3, cell, COLS, ROWS)).toEqual({ left: 400 - 1020, top: 300 - 894 })
    // A focus in a corner is held so the canvas still fills the box.
    expect(zoomOffset({ x: 0, y: 0 }, 3, cell, COLS, ROWS)).toEqual({ left: 0, top: 0 })
    expect(zoomOffset({ x: 200, y: 150 }, 2, cell, COLS, ROWS)).toEqual({ left: 800 - 1600, top: 600 - 1200 })
  })
})
