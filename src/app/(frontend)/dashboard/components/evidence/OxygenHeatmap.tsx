"use client";

import { useMemo, useState } from "react";
import {
  bandIndexFor,
  computeEvidenceScores,
  computeMaterialMetrics,
  deriveO2Bands,
  type ParsedRow,
  type ScoredMaterial,
} from "@/lib/combustion";
import { C, panelCls, panelStyle } from "../ui/chart-theme";

type SortMode = "name" | "tests" | "score"

/**
 * Oxygen-coverage heatmap: materials × oxygen-concentration bands.
 *
 * Filled cells mean at least one valid test exists for that material in that
 * band. Empty cells mean no recorded tests — an evidence gap, NOT proof that
 * the condition is safe or unsafe. Rows without a usable starting-O2 reading
 * are counted separately so "zero tests" is never confused with "unreadable
 * measurements".
 */
export default function OxygenHeatmap({ rows }: { rows: ParsedRow[] }) {
  const [bandWidth, setBandWidth] = useState(1)
  const [sort, setSort] = useState<SortMode>("score")

  const bands = useMemo(
    () => deriveO2Bands(
      rows.map((r) => r.o2i).filter((v): v is number => v !== null),
      { widthPct: bandWidth },
    ),
    [rows, bandWidth],
  )

  const metrics = useMemo(() => computeMaterialMetrics(rows, bands), [rows, bands])
  const scored = useMemo(
    () => computeEvidenceScores(metrics, { testCoverage: 0.5, o2Diversity: 0.3, o2Range: 0.2 }),
    [metrics],
  )
  const scoreOf = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const s of scored) m.set(s.material, s.score)
    return m
  }, [scored])

  // Per-material, per-band test counts straight from the parsed rows.
  const counts = useMemo(() => {
    const m = new Map<string, Map<number, number>>()
    for (const r of rows) {
      if (r.o2i === null) continue
      const idx = bandIndexFor(bands, r.o2i)
      if (idx < 0) continue
      if (!m.has(r.material)) m.set(r.material, new Map())
      const row = m.get(r.material)!
      row.set(idx, (row.get(idx) ?? 0) + 1)
    }
    return m
  }, [rows, bands])

  const unreadableO2 = useMemo(
    () => rows.filter((r) => r.o2i === null || Number.isNaN(r.o2i)).length,
    [rows],
  )

  const sortedMaterials = useMemo(() => {
    const arr = [...scored]
    switch (sort) {
      case "name":
        arr.sort((a, b) => a.material.localeCompare(b.material))
        break
      case "tests":
        arr.sort((a, b) => b.tests - a.tests || a.material.localeCompare(b.material))
        break
      default:
        arr.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.material.localeCompare(b.material))
    }
    return arr
  }, [scored, sort])

  return (
    <div className={panelCls} style={panelStyle}>
      <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
        Oxygen Coverage Heatmap
      </h3>
      <p className="mt-1 text-[11px]" style={{ color: C.muted }}>
        Which material–oxygen combinations have at least one valid test. Filled cells show the
        test count; empty cells are evidence gaps, not proof of safety.
      </p>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
          Band width
          <select
            value={bandWidth}
            onChange={(e) => setBandWidth(Number(e.target.value))}
            className="rounded-lg border px-2 py-1 text-[11px]"
            style={{ borderColor: C.line, background: C.panel2, color: C.fg }}
          >
            <option value={1}>1% O₂</option>
            <option value={2}>2% O₂</option>
            <option value={3}>3% O₂</option>
          </select>
        </label>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
          Sort by
          {(["score", "name", "tests"] as SortMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setSort(m)}
              className="rounded-full border px-2.5 py-0.5 text-[11px] transition-colors"
              style={{
                borderColor: sort === m ? C.blue : C.line,
                background: sort === m ? `${C.blue}22` : 'transparent',
                color: sort === m ? C.blue : C.muted,
              }}
            >
              {m === "score" ? "Evidence score" : m === "name" ? "Name" : "Test count"}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div className="mt-3 overflow-x-auto rounded-xl border" style={{ borderColor: C.line }}>
        <table className="w-full border-collapse text-left text-[11px]">
          <thead>
            <tr style={{ background: '#16283a' }}>
              <th className="sticky left-0 z-10 px-2.5 py-2 font-medium" style={{ color: C.muted, background: '#16283a' }}>
                Material
              </th>
              {bands.map((b) => (
                <th key={b.label} className="whitespace-nowrap px-2 py-2 text-center font-medium" style={{ color: C.muted }}>
                  {b.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-2 py-2 text-center font-medium" style={{ color: C.muted }}>
                No valid O₂
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMaterials.map((m: ScoredMaterial) => {
              const row = counts.get(m.material) ?? new Map<number, number>()
              return (
                <tr key={m.material} className="border-t" style={{ borderColor: C.line }}>
                  <td className="sticky left-0 z-10 px-2.5 py-1.5" style={{ background: C.ink2 }}>
                    <span style={{ color: C.fg }}>{m.material}</span>
                    <span className="ml-1.5 text-[10px] tabular-nums" style={{ color: C.muted }}>
                      {m.tests} tests
                    </span>
                  </td>
                  {bands.map((b, i) => {
                    const n = row.get(i) ?? 0
                    return (
                      <td key={b.label} className="px-1 py-1 text-center">
                        {n > 0 ? (
                          <span
                            className="inline-block min-w-[28px] rounded-md px-1.5 py-0.5 text-[11px] tabular-nums"
                            style={{ background: `${C.blue}33`, color: C.blue }}
                            title={`${m.material} · ${b.label} O₂ band: ${n} test${n === 1 ? '' : 's'}`}
                          >
                            {n}
                          </span>
                        ) : (
                          <span
                            className="inline-block min-w-[28px] rounded-md px-1.5 py-0.5 text-[11px]"
                            style={{ background: 'rgba(255,255,255,0.03)', color: C.muted }}
                            title={`${m.material} · ${b.label} O₂ band: no recorded tests (evidence gap)`}
                          >
                            0
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-1 py-1 text-center">
                    {m.hasO2Data ? (
                      <span className="text-[10px]" style={{ color: C.muted }}>—</span>
                    ) : (
                      <span
                        className="inline-block rounded-md px-1.5 py-0.5 text-[10px]"
                        style={{ background: `${C.amber}22`, color: C.amber }}
                        title={`${m.material}: ${m.tests} test(s) without a usable starting-O2 reading`}
                      >
                        {m.tests}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {sortedMaterials.length === 0 && (
              <tr>
                <td colSpan={bands.length + 2} className="px-3 py-4 text-center" style={{ color: C.muted }}>
                  No materials in the current selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend + explanation */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]" style={{ color: C.muted }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: `${C.blue}33`, border: `1px solid ${C.blue}` }} />
          ≥1 valid test (number = test count)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }} />
          No recorded tests — evidence gap, not proof of safety
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: `${C.amber}22`, border: `1px solid ${C.amber}` }} />
          Rows without a usable O₂ reading
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-4" style={{ color: C.muted }}>
        Bands are {bandWidth}% O₂ wide, aligned to whole percentages and derived from the observed
        data range ({bands.length > 0 ? `${bands[0].min}–${bands[bands.length - 1].max}%` : 'no valid O₂ readings'}).
        {unreadableO2 > 0 && (
          <> {unreadableO2} row{unreadableO2 === 1 ? '' : 's'} have no usable starting-O2 reading and cannot be placed in any band — shown separately above.</>
        )}
        This chart reveals experimental coverage and gaps; it does not imply that untested conditions are safe or unsafe.
      </p>
    </div>
  )
}
