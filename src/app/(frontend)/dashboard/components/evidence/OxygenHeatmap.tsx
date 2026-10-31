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
import type { DataRow } from "@/lib/types";
import { C, panelCls, panelStyle } from "../ui/chart-theme";

type SortMode = "name" | "tests" | "score";

const REFERENCE_LINES = [
  { pct: 21, label: "ISS / Earth", desc: "14.7 psi" },
  { pct: 30, label: "Lunar base / rover", desc: "≤10.2 psi" },
  { pct: 100, label: "Spacesuit (EMU)", desc: "4.3 psi" },
] as const;

/**
 * Real SVG-based oxygen-coverage heatmap: materials × oxygen-concentration bands.
 *
 * Filled cells mean at least one valid test exists for that material in that
 * band. Empty cells mean no recorded tests — an evidence gap, NOT proof that
 * the condition is safe or unsafe.
 */
export default function OxygenHeatmap({ rows, rawRows }: { rows: ParsedRow[]; rawRows: DataRow[] }) {
  const [bandWidth, setBandWidth] = useState(1);
  const [sort, setSort] = useState<SortMode>("score");
  const [selectedCell, setSelectedCell] = useState<{ material: string; bandIdx: number } | null>(null);

  const bands = useMemo(
    () =>
      deriveO2Bands(
        rows.map((r) => r.o2i).filter((v): v is number => v !== null),
        { widthPct: bandWidth },
      ),
    [rows, bandWidth],
  );

  const metrics = useMemo(() => computeMaterialMetrics(rows, bands), [rows, bands]);
  const scored = useMemo(
    () => computeEvidenceScores(metrics, { testCoverage: 0.5, o2Diversity: 0.3, o2Range: 0.2 }),
    [metrics],
  );

  // Build lookup: material -> bandIdx -> ParsedRow[]
  const cellRows = useMemo(() => {
    const m = new Map<string, Map<number, ParsedRow[]>>();
    for (const r of rows) {
      if (r.o2i === null) continue;
      const idx = bandIndexFor(bands, r.o2i);
      if (idx < 0) continue;
      if (!m.has(r.material)) m.set(r.material, new Map());
      const rowMap = m.get(r.material)!;
      const list = rowMap.get(idx) ?? [];
      list.push(r);
      rowMap.set(idx, list);
    }
    return m;
  }, [rows, bands]);

  // Build lookup: parsedRow._idx -> raw DataRow (for paper links)
  const rawByIdx = useMemo(() => {
    const m = new Map<number, DataRow>();
    for (const r of rawRows) {
      if (r._index !== null && r._index !== undefined) m.set(r._index, r);
    }
    return m;
  }, [rawRows]);

  // Gap finder: materials with no valid tests at or above the threshold
  const [gapThreshold, setGapThreshold] = useState(bands.length > 0 ? bands[bands.length - 1].max : 21);
  const gapFinder = useMemo(() => {
    if (bands.length === 0) return [] as string[];
    const thresholdIdx = bands.findIndex((b) => b.min >= gapThreshold);
    const relevantBands = thresholdIdx >= 0 ? bands.slice(thresholdIdx) : bands;
    const relevantIdxs = new Set(relevantBands.map((_, i) => i + (thresholdIdx >= 0 ? thresholdIdx : 0)));
    // Actually simpler: find bands where max >= threshold
    const aboveIdxs = new Set<number>();
    for (let i = 0; i < bands.length; i++) {
      if (bands[i].max >= gapThreshold) aboveIdxs.add(i);
    }
    const gaps: string[] = [];
    for (const m of scored) {
      const row = cellRows.get(m.material);
      let hasTest = false;
      if (row) {
        for (const idx of aboveIdxs) {
          if ((row.get(idx)?.length ?? 0) > 0) { hasTest = true; break; }
        }
      }
      if (!hasTest) gaps.push(m.material);
    }
    return gaps;
  }, [scored, cellRows, bands, gapThreshold]);

  const sortedMaterials = useMemo(() => {
    const arr = [...scored];
    switch (sort) {
      case "name":
        arr.sort((a, b) => a.material.localeCompare(b.material));
        break;
      case "tests":
        arr.sort((a, b) => b.tests - a.tests || a.material.localeCompare(b.material));
        break;
      default:
        arr.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.material.localeCompare(b.material));
    }
    return arr;
  }, [scored, sort]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const row of cellRows.values()) {
      for (const n of row.values()) {
        if (n.length > max) max = n.length;
      }
    }
    return max;
  }, [cellRows]);

  const colorFor = (count: number) => {
    if (count === 0) return "rgba(255,255,255,0.03)";
    const t = maxCount > 0 ? count / maxCount : 0;
    // Interpolate from muted blue to bright amber
    const r = Math.round(79 + (255 - 79) * t);
    const g = Math.round(163 + (166 - 163) * t);
    const b = Math.round(255 + (77 - 255) * t);
    return `rgb(${r},${g},${b})`;
  };

  // Dimensions — wider cells for readability
  const cellW = 52;
  const cellH = 24;
  const labelW = 140;
  const headerH = 30;
  const gap = 3;

  const selectedRows = useMemo(() => {
    if (!selectedCell) return [] as { row: ParsedRow; raw: DataRow }[];
    const rowMap = cellRows.get(selectedCell.material);
    if (!rowMap) return [];
    const list = rowMap.get(selectedCell.bandIdx) ?? [];
    return list.map((r) => ({ row: r, raw: rawByIdx.get(r._idx) ?? ({} as DataRow) }));
  }, [selectedCell, cellRows, rawByIdx]);

  const xForBand = (idx: number) => labelW + idx * (cellW + gap);
  const yForMat = (idx: number) => headerH + idx * (cellH + gap);

  return (
    <div className={panelCls} style={panelStyle}>
      <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
        Oxygen Coverage Heatmap
      </h3>
      <p className="mt-1 text-[11px]" style={{ color: C.muted }}>
        Real oxygen-concentration coverage. Filled cells show test count; empty cells are evidence gaps, not proof of safety.
      </p>

      {/* Gap finder card */}
      <div className="mt-3 rounded-xl border p-4" style={{ borderColor: C.line, background: C.panel2 }}>
        <div className="mb-2 text-[12px] font-medium" style={{ color: C.fg }}>Gap finder</div>
        <p className="text-[11px] leading-5" style={{ color: C.muted }}>
          Shows materials that have no valid tests at or above the selected O₂ threshold. Use this to spot where
          the experimental record is thin for higher-oxygen environments — a plain list is easier to read than
          scanning the heatmap manually.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]" style={{ color: C.muted }}>
          <span>Threshold:</span>
          <select
            value={gapThreshold}
            onChange={(e) => setGapThreshold(Number(e.target.value))}
            className="rounded-lg border px-2 py-1 text-[11px]"
            style={{ borderColor: C.line, background: C.panel2, color: C.fg }}
          >
            {bands.map((b) => (
              <option key={b.label} value={b.min}>{b.min}%</option>
            ))}
          </select>
          <span>O₂</span>
        </div>
        {gapFinder.length === 0 ? (
          <div className="mt-3 rounded-lg border p-3 text-[11px]" style={{ borderColor: C.line, background: C.ink2, color: C.green }}>
            All materials have at least one valid test at or above this threshold.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {gapFinder.map((material) => {
              const m = scored.find((s) => s.material === material);
              const totalTests = m?.tests ?? 0;
              return (
                <div
                  key={material}
                  className="rounded-lg border p-2.5 text-[11px]"
                  style={{ borderColor: C.line, background: C.ink2 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: C.amber }} />
                    <span style={{ color: C.fg }} className="font-medium">{material}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3" style={{ color: C.muted }}>
                    <span className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                      No tests ≥{gapThreshold}% O₂
                    </span>
                    <span style={{ color: C.muted }}>
                      {totalTests} total test{totalTests === 1 ? '' : 's'}
                    </span>
                  </div>
                  {/* Visual bar showing coverage depth */}
                  <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: C.chip2 }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(100, (totalTests / (scored[0]?.tests ?? 1)) * 100)}%`,
                        background: C.amber,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
              className="rounded-full border px-2.5 py-0.5 text-[11px] transition-colors hover:brightness-110"
              style={{
                borderColor: sort === m ? C.blue : C.line,
                background: sort === m ? C.blue : C.surface,
                color: sort === m ? C.ink : C.muted,
              }}
            >
              {m === "score" ? "Evidence score" : m === "name" ? "Name" : "Test count"}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Heatmap */}
      <div className="mt-3 overflow-x-auto rounded-xl border" style={{ borderColor: C.line }}>
        <svg
          width={labelW + bands.length * (cellW + gap) + gap}
          height={headerH + sortedMaterials.length * (cellH + gap) + gap}
          style={{ display: "block" }}
        >
          {/* Background */}
          <rect x={0} y={0} width="100%" height="100%" fill={C.ink2} />

          {/* Column headers */}
          {bands.map((b, i) => (
            <g key={b.label}>
              <text
                x={xForBand(i) + cellW / 2}
                y={headerH / 2 + 4}
                textAnchor="middle"
                className="text-[10px]"
                style={{ fill: C.muted, fontFamily: "inherit", fontSize: "10px" }}
              >
                {b.label}
              </text>
            </g>
          ))}

          {/* Reference lines */}
          {(() => {
            if (bands.length === 0) return null;
            const xMin = bands[0].min;
            const xMax = bands[bands.length - 1].max;
            const xRange = xMax - xMin || 1;
            const chartLeft = labelW;
            const chartRight = labelW + bands.length * (cellW + gap);
            const xForPct = (pct: number) => chartLeft + ((pct - xMin) / xRange) * (chartRight - chartLeft);
            return REFERENCE_LINES.map((ref) => {
              const x = Math.max(chartLeft, Math.min(chartRight, xForPct(ref.pct)));
              return (
                <g key={`ref-${ref.pct}`}>
                  <line
                    x1={x}
                    y1={headerH}
                    x2={x}
                    y2={headerH + sortedMaterials.length * (cellH + gap)}
                    stroke={C.amber}
                    strokeWidth={1}
                    strokeDasharray="3,2"
                    opacity={0.6}
                  />
                  <text
                    x={x}
                    y={headerH + sortedMaterials.length * (cellH + gap) + 14}
                    textAnchor="middle"
                    style={{ fill: C.amber, fontFamily: "inherit", fontSize: "9px" }}
                  >
                    {ref.label}
                  </text>
                  <title>{`${ref.label} (${ref.desc})`}</title>
                </g>
              );
            });
          })()}

          {/* Rows */}
          {sortedMaterials.map((m, rowIdx) => {
            const row = cellRows.get(m.material) ?? new Map<number, ParsedRow[]>();
            const y = yForMat(rowIdx);
            return (
              <g key={m.material}>
                {/* Material label */}
                <text
                  x={labelW - 8}
                  y={y + cellH / 2 + 4}
                  textAnchor="end"
                  style={{ fill: C.fg, fontFamily: "inherit", fontSize: "11px" }}
                >
                  {m.material}
                </text>
                {/* Cells */}
                {bands.map((_, i) => {
                  const list = row.get(i) ?? [];
                  const n = list.length;
                  const cx = xForBand(i) + cellW / 2;
                  const cy = y + cellH / 2;
                  const isSelected = selectedCell?.material === m.material && selectedCell?.bandIdx === i;
                  return (
                    <g
                      key={i}
                      onClick={() => setSelectedCell(isSelected ? null : { material: m.material, bandIdx: i })}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        x={xForBand(i)}
                        y={y}
                        width={cellW}
                        height={cellH}
                        rx={3}
                        fill={colorFor(n)}
                        stroke={isSelected ? C.blue : "transparent"}
                        strokeWidth={isSelected ? 1.5 : 0}
                      />
                      <title>{`${m.material} · ${bands[i].label} O₂ band: ${n} test${n === 1 ? "" : "s"}`}</title>
                      {n > 0 && (
                        <text
                          x={cx}
                          y={cy + 4}
                          textAnchor="middle"
                          style={{ fill: n > maxCount / 2 ? C.ink : C.fg, fontFamily: "inherit", fontSize: "11px", fontWeight: 500 }}
                        >
                          {n}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* No valid O2 column indicator (small amber bar on right) */}
          {sortedMaterials.map((m, rowIdx) => {
            const y = yForMat(rowIdx);
            return (
              <rect
                key={`no-o2-${m.material}`}
                x={labelW + bands.length * (cellW + gap)}
                y={y}
                width={cellW}
                height={cellH}
                rx={3}
                fill={m.hasO2Data ? "transparent" : `${C.amber}33`}
                stroke={m.hasO2Data ? "transparent" : C.amber}
                strokeWidth={0.5}
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]" style={{ color: C.muted }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: `${C.blue}33`, border: `1px solid ${C.blue}` }} />
          ≥1 valid test (color intensity = test count)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }} />
          No recorded tests — evidence gap, not proof of safety
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: `${C.amber}22`, border: `1px solid ${C.amber}` }} />
          Rows without a usable O₂ reading
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: C.amber, opacity: 0.4 }} />
          Reference line (ISS / Lunar / Spacesuit)
        </span>
      </div>

      {/* Cell drill-down */}
      {selectedCell && selectedRows.length > 0 && (
        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.panel2 }}>
          <div className="mb-2 text-[11px]" style={{ color: C.fg }}>
            {selectedCell.material} · {bands[selectedCell.bandIdx].label} O₂ — {selectedRows.length} test{selectedRows.length === 1 ? "" : "s"}
          </div>
          <div className="space-y-1">
            {selectedRows.map(({ row, raw }) => (
              <div key={row._idx} className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
                <span style={{ color: C.fg }}>Test {row.testNo ?? "—"}</span>
                <span>O₂i {row.o2i ?? "—"}%</span>
                <span>O₂f {row.o2f ?? "—"}%</span>
                {raw._paper && (
                  <a
                    href={`https://ntrs.nasa.gov/citations/${raw._paper}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    style={{ color: C.blue }}
                  >
                    Paper {raw._paper}
                  </a>
                )}
                {!raw._paper && <span>No paper link</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-2 text-[10px] leading-4" style={{ color: C.muted }}>
        Bands are {bandWidth}% O₂ wide, aligned to whole percentages and derived from the observed
        data range ({bands.length > 0 ? `${bands[0].min}–${bands[bands.length - 1].max}%` : "no valid O₂ readings"}).
        Reference lines: ISS/Earth ≈21% O₂ (14.7 psi), Lunar base/rover ≈30% O₂ (≤10.2 psi),
        Spacesuit (EMU) 100% O₂ (4.3 psi).
        This chart reveals experimental coverage and gaps; it does not imply that untested conditions are safe or unsafe.
      </p>
    </div>
  );
}
