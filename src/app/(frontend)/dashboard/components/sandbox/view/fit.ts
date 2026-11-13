// fit.ts - how big a cell is when the sandbox canvas fits its panel. No DOM;
// tested in tests/int/sandbox-clock.spec.ts.

/** Below this many device pixels per cell, whole-pixel cells would be too small. */
export const MIN_WHOLE_DEVICE_PX = 2;

/**
 * CSS pixels per cell so a `cols` x `rows` grid fits `availW` x `availH` CSS
 * pixels and keeps its shape: a whole number of device pixels per cell (sharp
 * cells), unless that would be under 2 device pixels, then the exact fit.
 */
/** Zoom levels of the sandbox view (display only). */
export const ZOOMS = [1, 2, 3] as const;
export type Zoom = (typeof ZOOMS)[number];

/** Above this a cell counts as part of the fire when centring the zoom, kelvin (display only). */
export const ZOOM_HOT_K = 400;

/**
 * The middle of the sample and its fire, in cells: the centre of the box round
 * every cell that still holds fuel or (with `temperature`) is hotter than
 * ZOOM_HOT_K; the chamber's centre when there is none.
 */
export function sampleCentre(fuel: ArrayLike<number>, cols: number, rows: number, temperature?: ArrayLike<number>): { x: number; y: number } {
  let x0 = cols, y0 = rows, x1 = -1, y1 = -1;
  for (let i = 0; i < cols * rows; i++) {
    if (fuel[i] > 0 || (temperature !== undefined && temperature[i] > ZOOM_HOT_K)) {
      const x = i % cols, y = (i / cols) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? { x: cols / 2, y: rows / 2 } : { x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2 };
}

/**
 * Where the zoomed canvas sits inside its box (CSS px, 0 or negative): the
 * focus cell in the middle of the box, but never past the chamber's edges.
 */
export function zoomOffset(focus: { x: number; y: number }, zoom: number, cell: number, cols: number, rows: number): { left: number; top: number } {
  const boxW = cols * cell, boxH = rows * cell;
  const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v));
  return {
    left: clamp(boxW / 2 - focus.x * cell * zoom, boxW - boxW * zoom),
    top: clamp(boxH / 2 - focus.y * cell * zoom, boxH - boxH * zoom),
  };
}

export function fitCell(availW: number, availH: number, cols: number, rows: number, dpr: number): number {
  const exact = Math.min(availW / cols, availH / rows);
  if (!(exact > 0)) return 1;
  const whole = Math.floor(exact * dpr) / dpr;
  return whole * dpr >= MIN_WHOLE_DEVICE_PX ? whole : exact;
}
