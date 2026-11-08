/**
 * feat/ui-visuals: the home page's flame picture is made by the sandbox
 * engine (src/scripts/home-flame.ts), not drawn. This checks the picture
 * against its facts file: made with the engine file the sandbox loads, the
 * same PNG, its size, and every pixel a colour of the Temperature view's
 * scale. (The script's --check reruns the engine and compares every pixel.)
 */
import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { decodePng, PNG_OUT, META_OUT } from '../../src/scripts/home-flame'
import { SCALES, sample } from '@/app/(frontend)/dashboard/components/sandbox/view/colors'

const meta = JSON.parse(fs.readFileSync(META_OUT, 'utf8'))
const png = fs.readFileSync(PNG_OUT)
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex')

describe('home page flame picture', () => {
  it('was made with the engine file the sandbox loads, and is the PNG its facts name', () => {
    const wasm = fs.readFileSync(path.join('src', 'app', '(frontend)', 'dashboard', 'components', 'sandbox', 'engine', 'flame_core.wasm'))
    expect(meta.engineWasmSha256).toBe(sha(wasm))
    expect(meta.pngSha256).toBe(sha(png))
    expect(meta).toMatchObject({ testId: 'B14', step: 1000, outcomeAtStep: 'still burning', scale: 4, image: '/home/b14-temperature.png' })
  })

  it('is the size its facts give: the crop times the scale', () => {
    const img = decodePng(png)
    expect([img.width, img.height]).toEqual([meta.width, meta.height])
    expect([img.width, img.height]).toEqual([meta.crop.width * meta.scale, meta.crop.height * meta.scale])
  })

  it('uses only the Temperature view\'s colours (one per kelvin, 0-1600 K), so it is the engine\'s view, not a drawing', () => {
    const allowed = new Set<string>()
    for (let k = 0; k <= 1600; k++) allowed.add(sample(SCALES.temperature.stops, k).join(','))
    const { rgba } = decodePng(png)
    const seen = new Set<string>()
    for (let p = 0; p < rgba.length; p += 4) {
      expect(rgba[p + 3]).toBe(255)
      seen.add(`${rgba[p]},${rgba[p + 1]},${rgba[p + 2]}`)
    }
    const outside = [...seen].filter((c) => !allowed.has(c))
    expect(outside).toEqual([])
    expect(seen.size).toBeGreaterThan(20) // a real flame: many temperatures, not a flat fill
  })
})
