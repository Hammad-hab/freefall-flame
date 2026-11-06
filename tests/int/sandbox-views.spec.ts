/**
 * feat/sandbox-co: the sandbox's views follow the desktop game (src/ui.c):
 * the same order, and a CO view on the game's scale (0 to 0.01) with its
 * "APPROXIMATE (a rule, not chemistry)" label.
 */
import { describe, it, expect } from 'vitest'
import {
  VIEWS,
  SCALES,
  CO_APPROX_LABEL,
  fillView,
  sample,
  type ColorEngine,
} from '@/app/(frontend)/dashboard/components/sandbox/view/colors'
import { KIND } from '@/app/(frontend)/dashboard/components/sandbox/engine/Engine'

// A 4-cell world: three gas cells with different CO, and one solid.
function world(co: number[]): ColorEngine {
  const n = co.length
  const zeros = () => new Float32Array(n)
  return {
    grid: {
      material: Uint8Array.from([0, 0, 0, 1]),
      temperature: Float32Array.from({ length: n }, () => 300),
      oxygen: zeros(),
      co2: zeros(),
      co: Float32Array.from(co),
      flowX: zeros(),
      flowY: zeros(),
    },
    materials: [
      { kind: KIND.GAS, r: 0, g: 0, b: 0 },
      { kind: KIND.STATIC, r: 200, g: 100, b: 50 },
    ],
    width: n,
    cells: n,
    camera: () => zeros(),
  }
}

const rgbAt = (px: Uint8ClampedArray, i: number) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]

describe('sandbox views match the game', () => {
  it('lists the views in the game order: Material, Temperature, Oxygen, Flow, CO2, CO, Camera', () => {
    expect([...VIEWS]).toEqual(['material', 'temperature', 'oxygen', 'flow', 'co2', 'co', 'camera'])
  })

  it('gives CO the game scale: 0 to 0.01, near black to near white, with the approximate label', () => {
    const s = SCALES.co
    expect(s.stops.map(([v]) => v)).toEqual([0, 0.0003, 0.002, 0.005, 0.01])
    expect(s.stops.map(([, c]) => c)).toEqual([
      [15, 15, 25], [35, 70, 40], [100, 150, 40], [225, 215, 60], [255, 255, 225],
    ])
    expect(s.note).toBe('APPROXIMATE (a rule, not chemistry)')
    expect(CO_APPROX_LABEL).toBe(s.note)
    // No other view carries a note.
    expect(Object.entries(SCALES).filter(([, v]) => v.note).map(([k]) => k)).toEqual(['co'])
  })

  it('colours gas cells by the engine CO field, solids in the no-gas grey', () => {
    const px = new Uint8ClampedArray(4 * 4)
    fillView(world([0, 0.005, 0.5, 0.005]), 'co', px)
    expect(rgbAt(px, 0)).toEqual([15, 15, 25])     // none
    // Yellow. The views draw from a 256-colour table (as every other view does),
    // so a value between two entries can be 1-2 units off the exact blend.
    const exact = sample(SCALES.co.stops, 0.005)
    rgbAt(px, 1).forEach((c, k) => expect(Math.abs(c - exact[k])).toBeLessThanOrEqual(2))
    expect(rgbAt(px, 2)).toEqual([255, 255, 225])  // above the top: held at the top colour
    expect(rgbAt(px, 3)).toEqual([45, 45, 52])     // a solid: no gas to show
  })

  it('keeps the other gas scales at the game ranges', () => {
    const top = (v: keyof typeof SCALES) => SCALES[v].stops[SCALES[v].stops.length - 1][0]
    expect(top('oxygen')).toBe(0.4)
    expect(top('co2')).toBe(0.21)
    expect(top('flow')).toBe(0.5)
    expect(top('temperature')).toBe(1600)
    expect(top('camera')).toBe(1)
  })
})
