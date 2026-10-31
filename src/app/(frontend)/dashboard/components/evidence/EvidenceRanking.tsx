"use client";

import { useMemo, useState } from "react";
import {
  computeEvidenceScores,
  computeMaterialMetrics,
  deriveO2Bands,
  type EvidenceWeights,
  type ScoredMaterial,
} from "@/lib/combustion";
import type { ParsedRow } from "@/lib/combustion";
import { C, panelCls, panelStyle } from "../ui/chart-theme";

type SortMode = "rank" | "name" | "tests" | "score";

const DEFAULT_WEIGHTS: EvidenceWeights = { testCoverage: 0.5, o2Diversity: 0.3, o2Range: 0.2 };

/**
 * Material Evidence Ranking.
 *
 * Ranks materials by the strength and coverage of the available evidence —
 * never by inferred fire danger. The scoring formula is transparent and its
 * weights are adjustable; scores recalculate immediately when weights change.
 */
export default function EvidenceRanking({ rows }: { rows: ParsedRow[] }) {
  const [weights, setWeights] = useState<EvidenceWeights>(DEFAULT_WEIGHTS);
  const [sort, setSort] = useState<SortMode>("rank");
  const [showFormula, setShowFormula] = useState(false);

  const bandWidth = 1;

  const bands = useMemo(
    () =>
      deriveO2Bands(
        rows.map((r) => r.o2i).filter((v): v is number => v !== null),
        { widthPct: bandWidth },
      ),
    [rows],
  );

  const metrics = useMemo(() => computeMaterialMetrics(rows, bands), [rows, bands]);
  const scored = useMemo(() => computeEvidenceScores(metrics, weights), [metrics, weights]);

  const weightSum = weights.testCoverage + weights.o2Diversity + weights.o2Range;
  const norm = (w: number) => (weightSum > 0 ? Math.round((w / weightSum) * 100) : 33);

  const sorted = useMemo(() => {
    const arr = [...scored];
    switch (sort) {
      case "name":
        arr.sort((a, b) => a.material.localeCompare(b.material));
        break;
      case "tests":
        arr.sort((a, b) => b.tests - a.tests || a.material.localeCompare(b.material));
        break;
      case "score":
        arr.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.material.localeCompare(b.material));
        break;
      default:
        arr.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.material.localeCompare(b.material));
    }
    return arr;
  }, [scored, sort]);

  const slider = (
    label: string,
    hint: string,
    key: keyof EvidenceWeights,
  ) => (
    <div className="rounded-xl border p-3" style={{ borderColor: C.line, background: C.panel2 }}>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-[12px]" style={{ color: C.fg }}>{label}</div>
          <div className="mt-0.5 text-[10px] leading-4" style={{ color: C.muted }}>{hint}</div>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[11px] tabular-nums" style={{ background: C.chip2, color: C.blue }}>
          {norm(weights[key])}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(weights[key] * 100)}
        onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) / 100 }))}
        className="mt-2 w-full accent-[#4fa3ff]"
        aria-label={`${label} weight`}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={panelCls} style={panelStyle}>
        <h2 className="text-[17px] font-light" style={{ color: C.fg }}>
          Material Evidence Ranking
        </h2>
        <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
          Ranks how much the available evidence covers each material — not how dangerous it is.
          Scores are evidence coverage, never fire-risk or safety ratings.
        </p>

        {/* Adjustable scoring formula */}
        <div className="mt-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
            Scoring weights (normalized to sum to 1)
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {slider("Test Coverage", "Share of the most-tested material's test count.", "testCoverage")}
            {slider("O₂ Condition Diversity", "Share of the most-tested material's distinct O₂ conditions.", "o2Diversity")}
            {slider("O₂ Range Coverage", "Share of the widest O₂ concentration range tested.", "o2Range")}
          </div>
        </div>

        {/* Inline formula expander */}
        <div className="mt-3">
          <button
            onClick={() => setShowFormula((v) => !v)}
            className="flex items-center gap-2 text-[11px] underline"
            style={{ color: C.blue }}
          >
            {showFormula ? "Hide" : "Show"} how this score is calculated
            <span style={{ color: C.muted }}>{showFormula ? "▲" : "▼"}</span>
          </button>
          {showFormula && (
            <div className="mt-2 rounded-xl border p-3 text-[11px] leading-5" style={{ borderColor: C.line, background: C.panel2, color: C.muted }}>
              <span style={{ color: C.fg }}>Evidence Score</span> = w₁·Test Coverage + w₂·O₂ Condition
              Diversity + w₃·O₂ Range Coverage. Each component is normalized 0–100 against the
              best-covered material in the current view; weights are normalized so they sum to 1. A
              component whose data is unknown (no valid O₂ readings) is excluded and the remaining
              weights are renormalized — missing evidence is not zero coverage. Scores are shown to
              one decimal to avoid false precision; tied scores share a rank. Mean O₂ consumed is a
              separate measured quantity and is deliberately not part of this score: it depends on
              sample size, burn duration, and experimental conditions.
            </div>
          )}
        </div>

        {/* Sort control */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
            Sort by
          </div>
          <div className="flex gap-2">
            {(["rank", "name", "tests", "score"] as SortMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setSort(m)}
                className="rounded-full border px-3 py-1 text-[11px] transition-colors hover:brightness-110"
                style={{
                  borderColor: sort === m ? C.blue : C.line,
                  background: sort === m ? C.blue : C.surface,
                  color: sort === m ? C.ink : C.muted,
                }}
              >
                {m === "rank" ? "Rank" : m === "name" ? "Name" : m === "tests" ? "Tests" : "Score"}
              </button>
            ))}
          </div>
        </div>

        {/* Ranking table */}
        <div className="mt-3 overflow-x-auto rounded-xl border" style={{ borderColor: C.line }}>
          <table className="w-full border-collapse text-left text-[11px]">
            <thead>
              <tr style={{ background: '#16283a' }}>
                {["Rank", "Material", "Score", "Test Cov.", "O₂ Div.", "O₂ Range", "Tests", "O₂ conditions", "O₂ range", "Bands", "Mean O₂ consumed (n)", "Excluded readings"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2.5 py-2 font-medium" style={{ color: C.muted }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m: ScoredMaterial) => (
                <tr key={m.material} className="border-t" style={{ borderColor: C.line }}>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: C.fg }}>
                    {m.rank}
                    {sorted.filter((x) => x.score === m.score).length > 1 && (
                      <span className="ml-1 text-[9px]" style={{ color: C.muted }}>tie</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2" style={{ color: C.fg }}>{m.material}</td>
                  <td className="px-2.5 py-2 font-medium tabular-nums" style={{ color: C.amber }}>
                    {m.score !== null ? m.score.toFixed(1) : '—'}
                  </td>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: C.muted }}>
                    {m.components.testCoverage !== null ? m.components.testCoverage.toFixed(0) : '—'}
                  </td>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: C.muted }}>
                    {m.components.o2Diversity !== null ? m.components.o2Diversity.toFixed(0) : 'n/a'}
                  </td>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: C.muted }}>
                    {m.components.o2Range !== null ? m.components.o2Range.toFixed(0) : 'n/a'}
                  </td>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: C.fg }}>{m.tests}</td>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: C.muted }}>{m.o2Conditions}</td>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: C.muted }}>
                    {m.o2Range !== null ? `${m.o2Range.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: C.muted }}>{m.o2BandsCovered}</td>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: C.blue }}>
                    {m.o2ConsumedMean !== null ? `${m.o2ConsumedMean.toFixed(1)}% (n=${m.o2ConsumedN})` : '—'}
                  </td>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: C.muted }}>
                    {m.excluded.censoredPlusOOR > 0 || m.excluded.missing > 0 ? (
                      <span style={{ color: m.excluded.censoredPlusOOR > 0 ? C.amber : C.muted }}>
                        {m.excluded.censoredPlusOOR} censored · {m.excluded.missing} missing
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-4 text-center" style={{ color: C.muted }}>
                    No materials in the current selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px]" style={{ color: C.muted }}>
          “Excluded readings” counts sensor readings that were censored (out of range) or missing in
          the CO/CO₂/O₂ columns. Means and maxima computed from the remaining readings may be
          biased low when high readings were excluded.
        </p>
      </div>
    </div>
  );
}
