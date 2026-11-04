// fit.ts - how big a cell is when the sandbox canvas fits its panel. No DOM;
// tested in tests/int/sandbox-clock.spec.ts.

/** Below this many device pixels per cell, whole-pixel cells would be too small. */
export const MIN_WHOLE_DEVICE_PX = 2;

/**
 * CSS pixels per cell so a `cols` x `rows` grid fits `availW` x `availH` CSS
 * pixels and keeps its shape: a whole number of device pixels per cell (sharp
 * cells), unless that would be under 2 device pixels, then the exact fit.
 */
export function fitCell(availW: number, availH: number, cols: number, rows: number, dpr: number): number {
  const exact = Math.min(availW / cols, availH / rows);
  if (!(exact > 0)) return 1;
  const whole = Math.floor(exact * dpr) / dpr;
  return whole * dpr >= MIN_WHOLE_DEVICE_PX ? whole : exact;
}
