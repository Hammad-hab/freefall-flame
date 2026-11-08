/**
 * The home page's flame picture, made by the sandbox engine, not drawn:
 * BASS-II test B14 run to step 1000 (it still burns; its flame goes out at
 * low flow at step 1492), drawn in the sandbox's Temperature view with its
 * own colour scale (view/colors.ts), cropped round the sample and enlarged
 * 4x with sharp pixels. No database, no network, no package: the PNG is
 * written with Node's zlib.
 *
 *   node --import tsx/esm src/scripts/home-flame.ts           # write the PNG and its facts
 *   node --import tsx/esm src/scripts/home-flame.ts --check   # rerun the engine, compare pixels, write nothing
 *
 * Output: public/home/b14-temperature.png and src/app/(frontend)/home-flame.json
 * (what the picture shows, the engine file's SHA-256 and the PNG's).
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import { loadEngine, LIGHT, OUTCOME } from '../app/(frontend)/dashboard/components/sandbox/engine/Engine'
import { fillView } from '../app/(frontend)/dashboard/components/sandbox/view/colors'

const ROOT = process.cwd()
const WASM = path.join(ROOT, 'src', 'app', '(frontend)', 'dashboard', 'components', 'sandbox', 'engine', 'flame_core.wasm')
export const PNG_OUT = path.join(ROOT, 'public', 'home', 'b14-temperature.png')
export const META_OUT = path.join(ROOT, 'src', 'app', '(frontend)', 'home-flame.json')

const TEST_ID = 'B14'
const STEP = 1000
const SCALE = 4
const PAD = 12 // cells of air kept round the hot region

// ---- PNG (8-bit RGBA, no filter): just enough to write, and read back for tests ----

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
export function encodePng(w: number, h: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit RGBA, no interlace
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0 // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (1 + w * 4) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
/** Read back a PNG this script wrote (8-bit RGBA, filter 0 on every row). */
export function decodePng(png: Buffer): { width: number; height: number; rgba: Uint8Array } {
  let at = 8
  let width = 0, height = 0
  const idat: Buffer[] = []
  while (at < png.length) {
    const len = png.readUInt32BE(at), type = png.toString('ascii', at + 4, at + 8)
    const data = png.subarray(at + 8, at + 8 + len)
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4) }
    if (type === 'IDAT') idat.push(data)
    at += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    if (raw[y * (1 + width * 4)] !== 0) throw new Error('unexpected PNG filter')
    rgba.set(raw.subarray(y * (1 + width * 4) + 1, (y + 1) * (1 + width * 4)), y * width * 4)
  }
  return { width, height, rgba }
}

// ---- The picture ----

export async function render() {
  const engine = await loadEngine()
  let id = -1
  for (let i = 0; i < engine.presetCount(); i++) if (engine.preset(i).testId === TEST_ID) id = i
  if (id < 0 || !engine.loadPreset(id, LIGHT.DEFAULT)) throw new Error(`${TEST_ID}: could not load`)
  engine.step(STEP)
  const o = engine.outcome()
  if (o.code !== OUTCOME.BURNING) throw new Error(`${TEST_ID} at step ${STEP}: "${o.name}", not still burning`)

  const W = engine.width, H = engine.height
  const full = new Uint8Array(engine.cells * 4)
  fillView(engine, 'temperature', full)

  // Crop round what is hot (over 400 K) or still has fuel, plus PAD cells of air.
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let i = 0; i < engine.cells; i++) {
    if (engine.grid.temperature[i] > 400 || engine.grid.fuel[i] > 0) {
      const x = i % W, y = (i / W) | 0
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
  }
  if (x1 < 0) throw new Error('nothing hot to crop round')
  x0 = Math.max(1, x0 - PAD); y0 = Math.max(1, y0 - PAD); x1 = Math.min(W - 2, x1 + PAD); y1 = Math.min(H - 2, y1 + PAD)
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1
  const w = cw * SCALE, h = ch * SCALE
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y0 + ((y / SCALE) | 0)) * W + (x0 + ((x / SCALE) | 0))) * 4
      out.set(full.subarray(s, s + 4), (y * w + x) * 4)
    }
  }
  return {
    width: w, height: h, rgba: out,
    meta: {
      about: 'Made by src/scripts/home-flame.ts from the sandbox engine (do not edit by hand): the Temperature view, the sandbox\'s own colour scale.',
      testId: TEST_ID,
      step: STEP,
      outcomeAtStep: o.name,
      crop: { x: x0, y: y0, width: cw, height: ch },
      scale: SCALE,
      engineWasmSha256: crypto.createHash('sha256').update(fs.readFileSync(WASM)).digest('hex'),
    },
  }
}

async function main() {
  const r = await render()
  const png = encodePng(r.width, r.height, r.rgba)
  if (process.argv.includes('--check')) {
    const old = decodePng(fs.readFileSync(PNG_OUT))
    const same = old.width === r.width && old.height === r.height && Buffer.compare(Buffer.from(old.rgba), Buffer.from(r.rgba)) === 0
    console.log(same ? `Same pixels as ${path.relative(ROOT, PNG_OUT)} (${r.width} x ${r.height}).` : `DIFFERENT from ${path.relative(ROOT, PNG_OUT)}: rerun without --check.`)
    if (!same) process.exitCode = 1
    return
  }
  fs.mkdirSync(path.dirname(PNG_OUT), { recursive: true })
  fs.writeFileSync(PNG_OUT, png)
  const meta = { ...r.meta, image: '/home/b14-temperature.png', width: r.width, height: r.height, pngSha256: crypto.createHash('sha256').update(png).digest('hex') }
  fs.writeFileSync(META_OUT, JSON.stringify(meta, null, 2) + '\n')
  console.log(`Wrote ${path.relative(ROOT, PNG_OUT)} (${r.width} x ${r.height}, ${png.length} bytes) and ${path.relative(ROOT, META_OUT)}.`)
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'home-flame.ts'))) {
  main().catch((e) => { console.error((e as Error).message); process.exitCode = 1 })
}
