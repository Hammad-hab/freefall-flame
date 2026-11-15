/**
 * General, dataset-agnostic derivations for the Visualization tab.
 *
 * The BASS-II charts need BASS-II's columns (initial/final O₂, CO, CO₂,
 * thickness, flow restrictor). Every other dataset is plotted from the columns
 * it actually has, resolved here by role rather than by dataset name:
 *
 *   material  → the canonical "Material / fuel" column, or a fuel column
 *   outcome   → the canonical outcome column
 *   o2        → an oxygen column, in whatever unit it is recorded in
 *   burnTime  → a burn-time column
 *   pressure  → a pressure column
 *
 * Pure functions, no React: the numbers are unit tested
 * (tests/int/general-charts.spec.ts) and the panel only draws them.
 */
import { numericValues } from './columns'
import { resolveColumn, type ColumnLike, type ColumnResolution } from './combustion'
import type { DataRow } from './types'

export interface GeneralColumns {
  material: ColumnResolution
  outcome: ColumnResolution
  o2: ColumnResolution
  burnTime: ColumnResolution
  pressure: ColumnResolution
}

/**
 * Resolve the general roles. Exact keys and labels win; fuzzy patterns are
 * last and only resolve when unique (resolveColumn flags an ambiguity rather
 * than guessing). Oxygen deliberately prefers the exact keys: a fuzzy "o2"
 * would match both `x_o2` and `x_o2_after` in CFI-G.
 */
export function resolveGeneralColumns(cols: ColumnLike[]): GeneralColumns {
  return {
    material: resolveColumn(cols, {
      role: 'material', canon: 'material',
      exactKeys: ['material', 'fuel'], exactLabels: ['Material', 'Fuel'],
      fuzzy: ['material', 'fuel'],
    }),
    outcome: resolveColumn(cols, {
      role: 'outcome', canon: 'outcome',
      exactKeys: ['outcome'], exactLabels: ['Outcome'], fuzzy: ['outcome'],
    }),
    o2: resolveColumn(cols, {
      role: 'o2',
      exactKeys: ['o2_initial', 'calibrated_initial_o2', 'x_o2', 'o2_pct', 'initial_o2', 'oxygen'],
      exactLabels: ['Calibrated initial O2', 'Initial O2', 'O₂ mole fraction', 'Oxygen'],
      fuzzy: ['o2', 'oxygen'],
    }),
    burnTime: resolveColumn(cols, {
      role: 'burnTime',
      exactKeys: ['burn_time_s', 'burn_time'], exactLabels: ['Burn time'],
      fuzzy: ['burn time', 'burn_time'],
    }),
    pressure: resolveColumn(cols, {
      role: 'pressure',
      exactKeys: ['pressure_atm', 'pressure_bar', 'pressure_mmhg'],
      exactLabels: ['Pressure'], fuzzy: ['pressure'],
    }),
  }
}

/* ------------------------------------------------------------------ */
/* Derivations                                                        */
/* ------------------------------------------------------------------ */

export type CountRow = { name: string; value: number }

/** Row counts per value of a category column, largest first. */
export function categoryCounts(rows: DataRow[], key: string): CountRow[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const v = r[key]
    if (v === null || v === undefined || String(v).trim() === '') continue
    const name = String(v)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

/** How many distinct non-empty values a column holds. */
export function distinctValues(rows: DataRow[], key: string): number {
  const set = new Set<string>()
  for (const r of rows) {
    const v = r[key]
    if (v === null || v === undefined || String(v).trim() === '') continue
    set.add(String(v))
  }
  return set.size
}

export function numericRange(rows: DataRow[], key: string): { min: number; max: number; n: number } | null {
  const vals = numericValues(rows, key)
  if (!vals.length) return null
  return { min: Math.min(...vals), max: Math.max(...vals), n: vals.length }
}

export type HistogramRow = { name: string; value: number }

/**
 * Equal-width bins across the observed range, in display order. Empty bins are
 * kept so the shape of the distribution reads; `bins` is capped because a
 * two-value column has no distribution to show.
 */
export function histogram(rows: DataRow[], key: string, bins = 10): HistogramRow[] {
  const vals = numericValues(rows, key)
  if (vals.length < 2) return []
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  if (min === max) return []
  const n = Math.min(bins, vals.length)
  const step = (max - min) / n
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  const fmt = (v: number) => v.toFixed(digits)
  const counts = new Array<number>(n).fill(0)
  for (const v of vals) {
    // The top edge belongs to the last bin, so the maximum is counted.
    const i = Math.min(n - 1, Math.floor((v - min) / step))
    counts[i] += 1
  }
  return counts.map((value, i) => ({ name: `${fmt(min + i * step)}–${fmt(min + (i + 1) * step)}`, value }))
}

export type ScatterPoint = { x: number; y: number; label: string }

/** Rows with both values, for a two-column scatter. Rows missing either are skipped and counted. */
export function scatter(
  rows: DataRow[],
  xKey: string,
  yKey: string,
  labelKey?: string | null,
): { points: ScatterPoint[]; skipped: number } {
  const points: ScatterPoint[] = []
  let skipped = 0
  for (const r of rows) {
    const x = r[xKey]
    const y = r[yKey]
    const xn = typeof x === 'number' && Number.isFinite(x) ? x : null
    const yn = typeof y === 'number' && Number.isFinite(y) ? y : null
    if (xn === null || yn === null) {
      skipped++
      continue
    }
    points.push({ x: xn, y: yn, label: labelKey ? String(r[labelKey] ?? '') : '' })
  }
  return { points, skipped }
}

/** A resolved column's label with its unit, for axis titles and headings. */
export function columnTitle(res: ColumnResolution): string | null {
  if (!res.column) return null
  return res.column.unit ? `${res.column.label} (${res.column.unit})` : res.column.label
}
