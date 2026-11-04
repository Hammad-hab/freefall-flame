// colors.ts - turn the engine's grid into pixels: one RGBA pixel per cell.
// The colour scales are the desktop game's, so the two look alike.
// No DOM here: fillView() writes into any Uint8ClampedArray (an
// ImageData's .data in the browser, a plain array in Node).

import { KIND, MAT } from '../engine/Engine';

const AIR = MAT.AIR;

export const VIEWS = ['material', 'temperature', 'oxygen', 'co2', 'flow', 'camera'] as const;
export type View = (typeof VIEWS)[number];

export type RGB = [number, number, number];
export type Stop = [value: number, color: RGB];
export type Pixels = Uint8ClampedArray | Uint8Array | number[];

// Minimal structural types for the engine; swap for the real ones from engine.ts if exported.
export interface Material { kind: number; r: number; g: number; b: number }
export interface Grid {
  material: ArrayLike<number>;
  temperature: ArrayLike<number>;
  oxygen: ArrayLike<number>;
  co2: ArrayLike<number>;
  flowX: ArrayLike<number>;
  flowY: ArrayLike<number>;
}
export interface ColorEngine {
  grid: Grid;
  materials: Material[];
  width: number;
  cells: number;
  camera(): ArrayLike<number>;
}

interface Lut { lo: number; hi: number; lut: Uint8Array; size: number }

// A colour scale: [value, [r, g, b]] stops; values between are blended.
const TEMP_STOPS: Stop[] = [
  [0, [70, 0, 140]], [200, [30, 60, 255]], [273.15, [110, 200, 255]], [300, [25, 25, 35]],
  [373.15, [120, 20, 20]], [700, [230, 50, 20]], [1100, [255, 160, 30]], [1600, [255, 245, 190]],
];
const OXY_STOPS: Stop[] = [
  [0, [60, 0, 30]], [0.06, [190, 30, 30]], [0.12, [240, 150, 30]], [0.21, [40, 170, 90]],
  [0.4, [170, 240, 255]],
];
const CO2_STOPS: Stop[] = [
  [0, [15, 15, 25]], [0.01, [55, 35, 100]], [0.05, [140, 55, 175]], [0.12, [235, 110, 170]],
  [0.21, [255, 235, 225]],
];
const FLOW_STOPS: Stop[] = [
  [0, [15, 15, 25]], [0.02, [25, 45, 130]], [0.1, [30, 140, 200]], [0.3, [150, 230, 240]],
  [0.5, [255, 255, 255]],
];
// The camera view (flame_core README): intensity 0..1 on these stops.
const CAMERA_STOPS: Stop[] = [
  [0, [0, 0, 0]], [0.15, [10, 20, 90]], [0.45, [40, 90, 255]], [0.75, [150, 190, 255]],
  [1, [255, 240, 200]],
];
const NO_GAS: RGB = [45, 45, 52];  // solids and liquids in the gas views
const CAMERA_SOLID_DIM = 0.12;     // solids at 12% of their colour in the camera view

// Precompute each scale as a lookup table of `size` colours, so a frame
// does no searching: index = round((size - 1) * (v - lo) / (hi - lo)).
function makeLut(stops: Stop[], size = 256): Lut {
  const lo = stops[0][0], hi = stops[stops.length - 1][0];
  const lut = new Uint8Array(size * 3);
  for (let i = 0; i < size; i++) lut.set(sample(stops, lo + (hi - lo) * (i / (size - 1))), i * 3);
  return { lo, hi, lut, size };
}

// One colour from a scale (exported for the legend and for tests).
export function sample(stops: Stop[], v: number): RGB {
  if (v <= stops[0][0]) return stops[0][1];
  for (let s = 1; s < stops.length; s++) {
    if (v <= stops[s][0]) {
      const [v0, c0] = stops[s - 1], [v1, c1] = stops[s];
      const t = (v - v0) / (v1 - v0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t)) as RGB;
    }
  }
  return stops[stops.length - 1][1];
}

// The temperature scale is uneven (its stops crowd round 300 K), so it gets
// a finer table: one entry per kelvin.
const LUTS = {
  temperature: makeLut(TEMP_STOPS, 1601),
  oxygen: makeLut(OXY_STOPS),
  co2: makeLut(CO2_STOPS),
  flow: makeLut(FLOW_STOPS),
  camera: makeLut(CAMERA_STOPS),
} satisfies Record<Exclude<View, 'material'>, Lut>;

export const SCALES: Record<Exclude<View, 'material' | 'temperature'> | 'temperature', { stops: Stop[]; unit: string }> = {
  // for legends: the stops and the unit
  temperature: { stops: TEMP_STOPS, unit: 'K' },
  oxygen: { stops: OXY_STOPS, unit: 'O2 fraction' },
  co2: { stops: CO2_STOPS, unit: 'CO2 fraction' },
  flow: { stops: FLOW_STOPS, unit: 'cells/step' },
  camera: { stops: CAMERA_STOPS, unit: 'glow 0..1' },
};

function put(out: Pixels, p: number, lut: Lut, v: number): void {
  const { lo, hi, size: n } = lut;
  let i = Math.round(((v - lo) / (hi - lo)) * (n - 1));
  if (i < 0) i = 0; else if (i > n - 1) i = n - 1;
  out[p] = lut.lut[i * 3]; out[p + 1] = lut.lut[i * 3 + 1]; out[p + 2] = lut.lut[i * 3 + 2]; out[p + 3] = 255;
}

// Fill `out` (cells * 4 bytes, RGBA) with one view of the engine's grid.
// `airColour`, if given, paints empty (air) cells in the material view, so the
// chamber matches the dashboard's background; no other colour changes.
export function fillView(engine: ColorEngine, view: View, out: Pixels, airColour: RGB | null = null): void {
  const { material, temperature, oxygen, co2, flowX, flowY } = engine.grid;
  const mats = engine.materials, W = engine.width, cells = engine.cells;
  const glow = view === 'camera' ? engine.camera() : null;   // fc_camera_intensity()
  for (let i = 0, p = 0; i < cells; i++, p += 4) {
    const m = mats[material[i]];
    const gas = m.kind === KIND.GAS;
    switch (view) {
      case 'temperature':
        put(out, p, LUTS.temperature, temperature[i]);
        break;
      case 'oxygen':
        if (gas) put(out, p, LUTS.oxygen, oxygen[i]); else setRgb(out, p, NO_GAS);
        break;
      case 'co2':
        if (gas) put(out, p, LUTS.co2, co2[i]); else setRgb(out, p, NO_GAS);
        break;
      case 'flow': {
        if (!gas) { setRgb(out, p, NO_GAS); break; }
        // Velocities live on faces: the cell's centre is the average of its
        // left/right faces (x) and top/bottom faces (y).
        const u = 0.5 * (flowX[i] + (i % W > 0 ? flowX[i - 1] : 0));
        const v = 0.5 * (flowY[i] + (i >= W ? flowY[i - W] : 0));
        put(out, p, LUTS.flow, Math.hypot(u, v));
        break;
      }
      case 'camera': {
        // Gas is black; solids and liquids barely visible; the glow on top.
        const base = gas ? 0 : CAMERA_SOLID_DIM;
        put(out, p, LUTS.camera, glow![i]);
        out[p] = Math.min(255, out[p] + m.r * base);
        out[p + 1] = Math.min(255, out[p + 1] + m.g * base);
        out[p + 2] = Math.min(255, out[p + 2] + m.b * base);
        break;
      }
      default:                                                   // 'material'
        if (airColour && material[i] === AIR) { setRgb(out, p, airColour); break; }
        out[p] = m.r; out[p + 1] = m.g; out[p + 2] = m.b; out[p + 3] = 255;
    }
  }
}

function setRgb(out: Pixels, p: number, c: RGB): void {
  out[p] = c[0]; out[p + 1] = c[1]; out[p + 2] = c[2]; out[p + 3] = 255;
}

// The air velocity at a cell's centre, for arrows and the readout.
export function centreVelocity(engine: ColorEngine, x: number, y: number): { u: number; v: number } {
  const { flowX, flowY } = engine.grid, W = engine.width, i = y * W + x;
  const u = 0.5 * (flowX[i] + (x > 0 ? flowX[i - 1] : 0));
  const v = 0.5 * (flowY[i] + (y > 0 ? flowY[i - W] : 0));
  return { u, v };
}