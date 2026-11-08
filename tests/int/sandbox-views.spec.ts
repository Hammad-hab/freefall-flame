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
  EXPOSURES,
  FUEL_NOTE,
  FUEL_TINT,
  FUEL_TINT_MAX,
  fuelTintWeight,
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

  it('camera exposure multiplies the glow before the same scale: no glow stays black, the top is capped', () => {
    expect([...EXPOSURES]).toEqual([1, 2, 4, 8])
    const w = world([0, 0, 0, 0])
    // Cells 0-2 are gas, cell 3 a solid (drawn at 12% of its colour under the glow).
    const glow = Float32Array.from([0, 0.1, 0.5, 0])
    w.camera = () => glow
    const at = (exposure: number) => { const px = new Uint8ClampedArray(16); fillView(w, 'camera', px, null, exposure); return [0, 1, 2].map((i) => rgbAt(px, i)) }
    const one = at(1), four = at(4)
    const scale = (v: number) => sample(SCALES.camera.stops, v)
    expect(one[0]).toEqual([0, 0, 0]) // no glow: black, at any exposure
    expect(four[0]).toEqual([0, 0, 0])
    // 0.1 at x4 is drawn as 0.4 on the same scale (within the table's 1-2 units), brighter than at x1.
    four[1].forEach((c, k) => expect(Math.abs(c - scale(0.4)[k])).toBeLessThanOrEqual(2))
    expect(four[1][2]).toBeGreaterThan(one[1][2])
    // 0.5 at x4 is past the top: the scale's top colour, never anything else.
    expect(four[2]).toEqual(scale(1))
    // x1 is the game's look: the same pixels as without an exposure.
    const plain = new Uint8ClampedArray(16), x1 = new Uint8ClampedArray(16)
    fillView(w, 'camera', plain); fillView(w, 'camera', x1, null, 1)
    expect([...x1]).toEqual([...plain])
  })

  it('Temperature view: solid fuel is tinted faintly when cold, never when hot, never gas or fuel-less solids', () => {
    expect(FUEL_NOTE).toBe('fuel shown faintly')
    // Cells: 0 air, 1 cold fuel (300 K), 2 cold wall (no fuel), 3 hot fuel (1000 K), 4 gas holding fuel.
    const w = world([0, 0, 0, 0, 0])
    w.grid.material = Uint8Array.from([0, 1, 1, 1, 0])
    w.grid.temperature = Float32Array.from([300, 300, 300, 1000, 300])
    w.grid.fuel = Float32Array.from([0, 1, 0, 1, 1])
    const px = new Uint8ClampedArray(5 * 4)
    fillView(w, 'temperature', px)
    const plain = new Uint8ClampedArray(5 * 4)
    fillView(w, 'temperature', plain, null, 1, false)
    const air = rgbAt(plain, 0)
    expect(rgbAt(px, 0)).toEqual(air)
    // Cold fuel: the 300 K colour blended toward FUEL_TINT, by fuelTintWeight of that colour.
    const wt = fuelTintWeight(air[0], air[1], air[2])
    expect(wt).toBeGreaterThan(0.25)
    expect(wt).toBeLessThanOrEqual(FUEL_TINT_MAX)
    expect(rgbAt(px, 1)).toEqual(air.map((c, k) => Math.round(c * (1 - wt) + FUEL_TINT[k] * wt)))
    // ...a green no temperature has (checked against every kelvin 0-1600), and brighter than the air.
    const scaleColours = new Set<string>()
    for (let k = 0; k <= 1600; k++) scaleColours.add(sample(SCALES.temperature.stops, k).join(','))
    expect(scaleColours.has(rgbAt(px, 1).join(','))).toBe(false)
    expect(rgbAt(px, 1)[1]).toBeGreaterThan(air[1] + 40)
    // A wall with no fuel, hot fuel, and gas: exactly the plain temperature colours.
    for (const i of [2, 3, 4]) expect(rgbAt(px, i)).toEqual(rgbAt(plain, i))
    expect(fuelTintWeight(...(rgbAt(plain, 3) as [number, number, number]))).toBe(0)
    // Turned off (the home page picture): no tint anywhere.
    expect(rgbAt(plain, 1)).toEqual(air)
    // Other views ignore the fuel field.
    const mat = new Uint8ClampedArray(5 * 4), matNoFuel = new Uint8ClampedArray(5 * 4)
    fillView(w, 'co2', mat); w.grid.fuel = new Float32Array(5); fillView(w, 'co2', matNoFuel)
    expect([...mat]).toEqual([...matNoFuel])
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
