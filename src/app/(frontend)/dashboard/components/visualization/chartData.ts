/**
 * Pure chart-data derivations for the visualization panel.
 *
 * Every function here is a plain function of the parsed rows — no React, no
 * recharts — so the numbers behind each chart can be unit tested without a DOM
 * and reused by any chart.
 */
import type { ParsedRow } from "@/lib/combustion";

/* ----------------------------- statistics ----------------------------- */

export const mean = (vals: number[]): number | null =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

export const stdev = (vals: number[]): number | null => {
  if (vals.length < 2) return null;
  const m = mean(vals)!
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
};

/* ------------------------------- shapes ------------------------------- */

/** One named bucket and how many rows fell into it. */
export type CountRow = { name: string; value: number };

/** A per-material mean, plus the sample size that backs it. */
export type GasByMaterialRow = { name: string; mean: number; std: number; n: number };

/** One gas's before/after means. Returned per gas so each gets its own scale. */
export type GasCompositionRow = {
  group: string;
  Initial: number | null;
  Final: number | null;
  n: number;
};

const byCountDesc = (a: CountRow, b: CountRow) =>
  b.value - a.value || a.name.localeCompare(b.name);

const countBy = (rows: ParsedRow[], labelOf: (r: ParsedRow) => string): CountRow[] => {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const name = labelOf(r);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort(byCountDesc);
};

/* ------------------------------ derivations ---------------------------- */

/** Tests per material, largest first. */
export const materialDistribution = (rows: ParsedRow[]): CountRow[] =>
  countBy(rows, (r) => r.material);

/**
 * Mean of one derived metric per material, with the sample size (n) behind it.
 * Rows where the metric is null are skipped rather than counted as zero.
 */
export function gasByMaterial(
  rows: ParsedRow[],
  pick: (r: ParsedRow) => number | null,
): GasByMaterialRow[] {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const v = pick(r);
    if (v === null) continue;
    if (!groups.has(r.material)) groups.set(r.material, []);
    groups.get(r.material)!.push(v);
  }
  return [...groups.entries()]
    .map(([name, vals]) => ({
      name,
      mean: mean(vals) ?? 0,
      std: stdev(vals) ?? 0,
      n: vals.length,
    }))
    .sort((a, b) => b.mean - a.mean || a.name.localeCompare(b.name));
}

/** Excluded (censored / out-of-range / missing) readings per material. */
export function excludedByMaterial(rows: ParsedRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const n = Object.values(r.readingClasses).filter(
      (k) => k === "censored" || k === "outOfRange" || k === "missing",
    ).length;
    m.set(r.material, (m.get(r.material) ?? 0) + n);
  }
  return m;
}

/** Thickness bucketed into the four documented ranges, in display order. */
export function thicknessDistribution(rows: ParsedRow[]): CountRow[] {
  const vals = rows.map((r) => r.thickness).filter((v): v is number => v !== null);
  if (!vals.length) return [];
  const bins = new Map<string, number>();
  for (const v of vals) {
    const key = v < 1 ? "<1" : v < 5 ? "1–5" : v < 10 ? "5–10" : "10+";
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  return ["<1", "1–5", "5–10", "10+"]
    .filter((k) => bins.has(k))
    .map((k) => ({ name: k, value: bins.get(k)! }));
}

/** Starting air velocity vs O₂ consumed — one point per test. */
export function velocityVsO2(rows: ParsedRow[]): { x: number; y: number; material: string }[] {
  return rows
    .filter((r) => r.airVel !== null && r.o2Consumed !== null)
    .map((r) => ({ x: r.airVel!, y: r.o2Consumed!, material: r.material }));
}

/** Tests per principal investigator. Rows without one are labelled "Unknown". */
export const principalInvestigatorBreakdown = (rows: ParsedRow[]): CountRow[] =>
  countBy(rows, (r) => r.pi ?? "Unknown");

/**
 * Before/after means for O₂ and CO₂, returned separately so each gas can be
 * plotted on its own scale (O₂ moves ~20%, CO₂ ~0.5%).
 */
export function gasComposition(rows: ParsedRow[]): {
  o2: GasCompositionRow[];
  co2: GasCompositionRow[];
} {
  const o2i = rows.map((r) => r.o2i).filter((v): v is number => v !== null);
  const o2f = rows.map((r) => r.o2f).filter((v): v is number => v !== null);
  const co2i = rows.map((r) => r.co2i).filter((v): v is number => v !== null);
  const co2f = rows.map((r) => r.co2f).filter((v): v is number => v !== null);
  return {
    o2: [
      { group: "Before tests", Initial: mean(o2i) ?? 0, Final: null, n: o2i.length },
      { group: "After tests", Initial: null, Final: mean(o2f) ?? 0, n: o2f.length },
    ],
    co2: [
      { group: "Before tests", Initial: mean(co2i) ?? 0, Final: null, n: co2i.length },
      { group: "After tests", Initial: null, Final: mean(co2f) ?? 0, n: co2f.length },
    ],
  };
}

export type SummaryStats = {
  consumed: number[];
  co: number[];
  co2: number[];
  excluded: number;
};

/** Valid readings behind the stat cards, plus how many were excluded. */
export function summaryStats(rows: ParsedRow[]): SummaryStats {
  const consumed = rows.map((r) => r.o2Consumed).filter((v): v is number => v !== null);
  const co = rows.map((r) => r.coProduced).filter((v): v is number => v !== null);
  const co2 = rows.map((r) => r.co2Produced).filter((v): v is number => v !== null);
  let excluded = 0;
  for (const r of rows) {
    excluded += Object.values(r.readingClasses).filter(
      (k) => k === "censored" || k === "outOfRange" || k === "missing",
    ).length;
  }
  return { consumed, co, co2, excluded };
}
