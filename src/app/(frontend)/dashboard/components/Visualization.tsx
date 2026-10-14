"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ScatterChart,
  Scatter,
  Legend,
} from "recharts";
import {
  buildRowMapping,
  computeMaterialMetrics,
  parseRows,
  resolveBass2Columns,
  type ParsedRow,
  type ReadingClass,
} from "@/lib/combustion";
import type { DatasetMeta, DataRow } from "@/lib/types";
import { C, CHART_COLORS, panelCls, panelStyle } from "./chart-theme";
import GenericCompare from "./GenericCompare";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const mean = (vals: number[]): number | null =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

const stdev = (vals: number[]): number | null => {
  if (vals.length < 2) return null;
  const m = mean(vals)!
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
};

const READING_LABEL: Record<ReadingClass, string> = {
  valid: "valid",
  missing: "missing",
  censored: "censored",
  outOfRange: "out of range",
  invalid: "invalid",
};

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Panel({
  title,
  subtitle,
  children,
  caveat,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  caveat?: string
}) {
  return (
    <div className={panelCls} style={panelStyle}>
      <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
        {title}
      </h3>
      {subtitle && (
        <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
          {subtitle}
        </p>
      )}
      {children}
      {caveat && (
        <p className="mt-2 text-[10px] leading-4" style={{ color: C.muted }}>
          {caveat}
        </p>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: C.line, background: C.panel2 }}>
      <div className="text-[11px] uppercase tracking-wider" style={{ color: C.muted }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none tabular-nums" style={{ color: accent ?? C.fg }}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px]" style={{ color: C.muted }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-[11px] transition-colors"
      style={{
        borderColor: active ? C.blue : C.line,
        background: active ? `${C.blue}22` : "transparent",
        color: active ? C.blue : C.muted,
      }}
    >
      {label}
    </button>
  )
}

/** Chart tooltip that always shows the sample size behind a mean. */
function ChartTooltip({
  active,
  payload,
  label,
  n,
  excluded,
  unit,
}: {
  active?: boolean
  payload?: ReadonlyArray<{
    name?: string | number
    value?: string | number | ReadonlyArray<string | number>
    color?: string
  }>
  label?: string | number
  n?: number
  excluded?: number
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-[11px] shadow-xl"
      style={{ borderColor: C.line, background: C.ink }}
    >
      {label !== undefined && label !== null && (
        <div className="mb-1 font-medium" style={{ color: C.fg }}>
          {String(label)}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? C.fg }}>
          {String(p.name)}:{" "}
          <span className="font-medium tabular-nums">
            {typeof p.value === "number"
              ? p.value.toFixed(2)
              : Array.isArray(p.value)
                ? p.value.join(", ")
                : String(p.value ?? "—")}
            {unit ?? ""}
          </span>
        </div>
      ))}
      {typeof n === "number" && (
        <div className="mt-1 border-t pt-1" style={{ borderColor: C.line, color: C.muted }}>
          n = {n} valid reading{n === 1 ? "" : "s"}
          {typeof excluded === "number" && excluded > 0 && ` · ${excluded} excluded (censored/missing)`}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function Visualization({
  dataset,
  rows,
}: {
  dataset: DatasetMeta
  rows: DataRow[];
}) {
  // Resolve every combustion role through the shared, validated resolver.
  const { resolutions, warnings } = useMemo(() => resolveBass2Columns(dataset.columns), [dataset.columns]);
  const mapping = useMemo(() => buildRowMapping(resolutions), [resolutions]);
  const parsed = useMemo(() => parseRows(rows, mapping), [rows, mapping]);

  const colOf = (role: string) => resolutions[role]?.column ?? null;
  const materialCol = colOf("material");
  const flowCol = colOf("flowRest");
  const o2iCol = colOf("o2Initial");
  const o2fCol = colOf("o2Final");
  const coiCol = colOf("coInitial");
  const cofCol = colOf("coFinal");
  const co2iCol = colOf("co2Initial");
  const co2fCol = colOf("co2Final");
  const airVelCol = colOf("airVelStart");
  const piCol = colOf("pi");
  const testNoCol = colOf("testNo");
  const thicknessCol = colOf("thickness");

  const hasBass2Columns = Boolean(materialCol && o2iCol && o2fCol);

  // Filter state — the controls stay visible even when nothing matches.
  const [materialFilter, setMaterialFilter] = useState<string>("All");
  const [flowFilter, setFlowFilter] = useState<string>("All");

  const materials = useMemo(
    () => ["All", ...new Set(parsed.map((r) => r.material))],
    [parsed],
  );
  const flows = useMemo(
    () => ["All", ...new Set(parsed.map((r) => r.flowRest).filter((v): v is string => v !== null))],
    [parsed],
  );

  const filtered = useMemo(
    () =>
      parsed.filter((r) => {
        if (materialFilter !== "All" && r.material !== materialFilter) return false;
        if (flowFilter !== "All" && r.flowRest !== flowFilter) return false;
        return true;
      }),
    [parsed, materialFilter, flowFilter],
  );

  const resetFilters = () => {
    setMaterialFilter("All");
    setFlowFilter("All");
  };

  // ── Chart data ────────────────────────────────────────────────────

  const materialDist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filtered) counts.set(r.material, (counts.get(r.material) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [filtered]);

  // Per-material means for one derived gas metric, with the sample size (n)
  // that backs each mean.
  const gasByMaterial = useCallback((pick: (r: ParsedRow) => number | null) => {
    const groups = new Map<string, number[]>();
    for (const r of filtered) {
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
  }, [filtered]);

  const o2ByMaterial = useMemo(() => gasByMaterial((r) => r.o2Consumed), [gasByMaterial]);
  const coByMaterial = useMemo(() => gasByMaterial((r) => r.coProduced), [gasByMaterial]);
  const co2ByMaterial = useMemo(() => gasByMaterial((r) => r.co2Produced), [gasByMaterial]);

  const excludedByMaterial = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      const n = Object.values(r.readingClasses).filter(
        (k) => k === "censored" || k === "outOfRange" || k === "missing",
      ).length;
      m.set(r.material, (m.get(r.material) ?? 0) + n);
    }
    return m;
  }, [filtered]);

  const thicknessDist = useMemo(() => {
    const vals = filtered.map((r) => r.thickness).filter((v): v is number => v !== null);
    if (!vals.length) return [];
    const bins = new Map<string, number>();
    for (const v of vals) {
      const key = v < 1 ? "<1" : v < 5 ? "1–5" : v < 10 ? "5–10" : "10+";
      bins.set(key, (bins.get(key) ?? 0) + 1);
    }
    const order = ["<1", "1–5", "5–10", "10+"];
    return order.filter((k) => bins.has(k)).map((k) => ({ name: k, count: bins.get(k)! }));
  }, [filtered]);

  const velVsO2 = useMemo(
    () =>
      filtered
        .filter((r) => r.airVel !== null && r.o2Consumed !== null)
        .map((r) => ({ x: r.airVel!, y: r.o2Consumed!, material: r.material })),
    [filtered],
  );

  const piBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filtered) {
      const k = r.pi ?? "Unknown";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [filtered]);

  // Gas composition — split into separate charts so O₂ (~20%) and CO₂
  // (~0.5%) each get a readable scale.
  const gasComp = useMemo(() => {
    const o2i = filtered.map((r) => r.o2i).filter((v): v is number => v !== null);
    const o2f = filtered.map((r) => r.o2f).filter((v): v is number => v !== null);
    const co2i = filtered.map((r) => r.co2i).filter((v): v is number => v !== null);
    const co2f = filtered.map((r) => r.co2f).filter((v): v is number => v !== null);
    return {
      o2: [
        { group: "Before tests", Initial: mean(o2i) ?? 0, Final: null as number | null, n: o2i.length },
        { group: "After tests", Initial: null as number | null, Final: mean(o2f) ?? 0, n: o2f.length },
      ],
      co2: [
        { group: "Before tests", Initial: mean(co2i) ?? 0, Final: null as number | null, n: co2i.length },
        { group: "After tests", Initial: null as number | null, Final: mean(co2f) ?? 0, n: co2f.length },
      ],
    };
  }, [filtered]);

  const summaryStats = useMemo(() => {
    const consumed = filtered.map((r) => r.o2Consumed).filter((v): v is number => v !== null);
    const co = filtered.map((r) => r.coProduced).filter((v): v is number => v !== null);
    const co2 = filtered.map((r) => r.co2Produced).filter((v): v is number => v !== null);
    let excluded = 0;
    for (const r of filtered) {
      excluded += Object.values(r.readingClasses).filter(
        (k) => k === "censored" || k === "outOfRange" || k === "missing",
      ).length;
    }
    return { consumed, co, co2, excluded };
  }, [filtered]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[17px] font-light" style={{ color: C.fg }}>
          Visualization
        </h2>
        <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
          {filtered.length} of {rows.length} rows · {dataset.name}
        </p>
      </div>

      {/* Mapping warnings (ambiguous columns, duplicate mappings) */}
      {warnings.length > 0 && (
        <div className="rounded-xl border p-3 text-[11px] leading-5" style={{ borderColor: `${C.amber}55`, background: `${C.amber}11`, color: C.fg }}>
          <span className="font-medium">Column mapping needs attention: </span>
          {warnings.join(" ")}
        </div>
      )}

      {/* Filters — always rendered, including in the empty state */}
      <div className="space-y-3">
        {materials.length > 1 && (
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
              Material
            </div>
            <div className="flex flex-wrap gap-2">
              {materials.map((m) => (
                <FilterPill key={m} label={m} active={materialFilter === m} onClick={() => setMaterialFilter(m)} />
              ))}
            </div>
          </div>
        )}
        {flows.length > 1 && (
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
              Flow restrictor
            </div>
            <div className="flex flex-wrap gap-2">
              {flows.map((f) => (
                <FilterPill key={f} label={f} active={flowFilter === f} onClick={() => setFlowFilter(f)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Empty state — filters stay visible and usable */}
      {filtered.length === 0 ? (
        <div className={panelCls} style={panelStyle}>
          <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
            No rows match the selected filters.
          </h3>
          <p className="mt-2 text-[12px]" style={{ color: C.muted }}>
            Adjust the material or flow restrictor filters above, or reset them to see all rows.
          </p>
          <button
            onClick={resetFilters}
            className="mt-3 rounded-full px-4 py-2 text-[12px] transition-opacity hover:opacity-90"
            style={{ background: C.blue, color: C.ink }}
          >
            Reset filters
          </button>
        </div>
      ) : hasBass2Columns ? (
        <>
          {/* Stat cards with sample sizes */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Tests"
              value={String(filtered.length)}
              sub={materialFilter !== "All" || flowFilter !== "All" ? "filtered selection" : "total rows"}
              accent={C.blue}
            />
            {summaryStats.consumed.length > 0 && (
              <StatCard
                label="Mean O₂ consumed"
                value={`${(mean(summaryStats.consumed) ?? 0).toFixed(1)}%`}
                sub={`n=${summaryStats.consumed.length} valid readings`}
                accent={C.amber}
              />
            )}
            {summaryStats.co.length > 0 && (
              <StatCard
                label="Mean CO produced"
                value={`${Math.round(mean(summaryStats.co) ?? 0)} ppm`}
                sub={`n=${summaryStats.co.length} valid readings`}
                accent={C.pink}
              />
            )}
            {summaryStats.co2.length > 0 && (
              <StatCard
                label="Mean CO₂ produced"
                value={`${(mean(summaryStats.co2) ?? 0).toFixed(2)}%`}
                sub={`n=${summaryStats.co2.length} valid readings`}
                accent={C.green}
              />
            )}
          </div>
          {summaryStats.excluded > 0 && (
            <div className="rounded-xl border p-3 text-[11px] leading-5" style={{ borderColor: `${C.amber}55`, background: `${C.amber}11`, color: C.fg }}>
              {summaryStats.excluded} sensor reading{summaryStats.excluded === 1 ? " was" : "s were"} censored,
              out of range, or missing in this selection. Means and maxima above are computed from the
              remaining valid readings only and may be biased low when high readings were excluded.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Material distribution — sorted bar (replaces the pie chart) */}
            {materialDist.length > 1 && (
              <Panel title="Tests per Material" subtitle="Number of tests for each material in the selection">
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={materialDist} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                      <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke={C.muted}
                        fontSize={11}
                        tickLine={false}
                        width={80}
                      />
                      <Tooltip
                        content={<ChartTooltip n={filtered.length} unit=" tests" />}
                      />
                      <Bar dataKey="value" name="Tests" fill={C.blue} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            {/* Gas composition: O₂ on its own scale */}
            {gasComp.o2.length > 0 && o2iCol && o2fCol && (
              <Panel
                title="Mean O₂ Before vs After Tests"
                subtitle="Average starting and ending oxygen concentration"
                caveat="Means use valid numeric readings only; censored or missing readings are excluded and counted in the Data Table."
              >
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gasComp.o2} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                      <XAxis dataKey="group" stroke={C.muted} fontSize={11} tickLine={false} />
                      <YAxis stroke={C.muted} fontSize={11} tickLine={false} unit="%" />
                      <Tooltip
                        content={<ChartTooltip n={filtered.length} unit="%" />}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px" }}
                        formatter={(v: string) => <span style={{ color: C.fg }}>{v}</span>}
                      />
                      <Bar dataKey="Initial" name="Before tests (mean)" fill={C.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Final" name="After tests (mean)" fill={C.amber} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            {/* Gas composition: CO₂ on its own scale */}
            {gasComp.co2.length > 0 && co2iCol && co2fCol && (
              <Panel
                title="Mean CO₂ Before vs After Tests"
                subtitle="Average carbon dioxide concentration"
                caveat="CO₂ changes are much smaller than O₂ changes, so this gas gets its own chart and scale."
              >
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gasComp.co2} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                      <XAxis dataKey="group" stroke={C.muted} fontSize={11} tickLine={false} />
                      <YAxis stroke={C.muted} fontSize={11} tickLine={false} unit="%" />
                      <Tooltip
                        content={<ChartTooltip n={filtered.length} unit="%" />}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px" }}
                        formatter={(v: string) => <span style={{ color: C.fg }}>{v}</span>}
                      />
                      <Bar dataKey="Initial" name="Before tests (mean)" fill={C.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Final" name="After tests (mean)" fill={C.green} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            {/* O2 consumed by material */}
            {o2ByMaterial.length > 0 && (
              <Panel
                title="Mean O₂ Consumed by Material"
                subtitle="Starting O₂ minus ending O₂, averaged per material"
              >
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={o2ByMaterial} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                      <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} unit="%" />
                      <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={11} tickLine={false} width={80} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as { n: number }
                          const ex = excludedByMaterial.get(label as string) ?? 0
                          return <ChartTooltip active={active} payload={payload} label={label} n={d.n} excluded={ex} unit="%" />
                        }}
                      />
                      <Bar dataKey="mean" name="Mean O₂ consumed (%)" fill={C.amber} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            {/* CO produced by material */}
            {coByMaterial.length > 0 && (
              <Panel title="Mean CO Produced by Material" subtitle="Carbon monoxide generated during combustion">
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coByMaterial} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                      <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} />
                      <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={11} tickLine={false} width={80} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as { n: number }
                          const ex = excludedByMaterial.get(label as string) ?? 0
                          return <ChartTooltip active={active} payload={payload} label={label} n={d.n} excluded={ex} unit=" ppm" />
                        }}
                      />
                      <Bar dataKey="mean" name="Mean CO produced (ppm)" fill={C.pink} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            {/* CO2 produced by material */}
            {co2ByMaterial.length > 0 && (
              <Panel title="Mean CO₂ Produced by Material" subtitle="Carbon dioxide generated during combustion">
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={co2ByMaterial} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                      <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} unit="%" />
                      <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={11} tickLine={false} width={80} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as { n: number }
                          const ex = excludedByMaterial.get(label as string) ?? 0
                          return <ChartTooltip active={active} payload={payload} label={label} n={d.n} excluded={ex} unit="%" />
                        }}
                      />
                      <Bar dataKey="mean" name="Mean CO₂ produced (%)" fill={C.green} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            {/* Thickness distribution */}
            {thicknessDist.length > 0 && thicknessCol && (
              <Panel title="Thickness Distribution" subtitle={`Sample thickness ranges (${thicknessCol.unit ?? "mm"})`}>
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={thicknessDist}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                      <XAxis dataKey="name" stroke={C.muted} fontSize={11} tickLine={false} />
                      <YAxis stroke={C.muted} fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip n={filtered.length} unit=" tests" />} />
                      <Bar dataKey="count" name="Tests" fill={C.blue} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            {/* Starting air velocity vs O2 consumed — explicitly a starting measurement */}
            {velVsO2.length > 2 && airVelCol && (
              <Panel
                title="Starting Air Velocity vs O₂ Consumed"
                subtitle="Each point is one test; velocity is the measurement taken at test start"
                caveat="Air velocity is the starting measurement only — not an average or full-test value."
              >
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="Starting air velocity (cm/s)"
                        stroke={C.muted}
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="O₂ consumed (%)"
                        stroke={C.muted}
                        fontSize={11}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as { material: string; x: number; y: number }
                          return (
                            <div
                              className="rounded-lg border px-3 py-2 text-[11px] shadow-xl"
                              style={{ borderColor: C.line, background: C.ink }}
                            >
                              <div style={{ color: C.fg }}>{d.material}</div>
                              <div style={{ color: C.blue }}>Starting velocity: {d.x} cm/s</div>
                              <div style={{ color: C.amber }}>O₂ consumed: {d.y.toFixed(1)}%</div>
                            </div>
                          )
                        }}
                      />
                      <Scatter data={velVsO2} fill={C.amber} opacity={0.7} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            {/* PI breakdown */}
            {piBreakdown.length > 1 && piCol && (
              <Panel title="Tests by Principal Investigator" subtitle="Number of experiments per researcher">
                <div className="mt-4 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={piBreakdown} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                      <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={11} tickLine={false} width={120} />
                      <Tooltip content={<ChartTooltip n={filtered.length} unit=" tests" />} />
                      <Bar dataKey="value" name="Tests" fill={C.blue} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}
          </div>

          {/* Data table — shows censored/out-of-range markers instead of hiding them */}
          <DataTable
            filtered={filtered}
            rows={rows}
            resolutions={resolutions}
            dataset={dataset}
          />
        </>
      ) : (
        /* Graceful degradation: required BASS-II columns are missing. */
        <div className={panelCls} style={panelStyle}>
          <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
            Combustion analysis unavailable for this dataset
          </h3>
          <p className="mt-2 text-[12px]" style={{ color: C.muted }}>
            This dataset does not include the columns needed for combustion analysis
            {materialCol ? "" : " (no material column)"}
            {o2iCol && o2fCol ? "" : " (no initial/final oxygen columns)"}. The charts are omitted
            rather than filled with unrelated columns. You can still explore this dataset with the
            generic comparison below.
          </p>
        </div>
      )}

      {/* Generic comparison — always available for any dataset */}
      <GenericCompare dataset={dataset} rows={rows} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data table                                                          */
/* ------------------------------------------------------------------ */

function DataTable({
  filtered,
  rows,
  resolutions,
  dataset,
}: {
  filtered: ParsedRow[];
  rows: DataRow[];
  resolutions: Record<string, { column: { key: string; label: string } | null }>;
  dataset: DatasetMeta;
}) {
  const col = (role: string) => resolutions[role]?.column ?? null;
  const testNoCol = col("testNo");
  const materialCol = col("material");
  const thicknessCol = col("thickness");
  const o2iCol = col("o2Initial");
  const o2fCol = col("o2Final");
  const coiCol = col("coInitial");
  const cofCol = col("coFinal");
  const co2iCol = col("co2Initial");
  const co2fCol = col("co2Final");
  const airVelCol = col("airVelStart");
  const piCol = col("pi");

  const columns = [
    testNoCol && { key: testNoCol.key, label: testNoCol.label },
    materialCol && { key: materialCol.key, label: materialCol.label },
    thicknessCol && { key: thicknessCol.key, label: thicknessCol.label },
    o2iCol && { key: o2iCol.key, label: `${o2iCol.label} (%)` },
    o2fCol && { key: o2fCol.key, label: `${o2fCol.label} (%)` },
    coiCol && { key: coiCol.key, label: `${coiCol.label} (ppm)` },
    cofCol && { key: cofCol.key, label: `${cofCol.label} (ppm)` },
    co2iCol && { key: co2iCol.key, label: `${co2iCol.label} (%)` },
    co2fCol && { key: co2fCol.key, label: `${co2fCol.label} (%)` },
    airVelCol && { key: airVelCol.key, label: `${airVelCol.label} (cm/s, start)` },
    piCol && { key: piCol.key, label: piCol.label },
  ].filter((c): c is { key: string; label: string } => Boolean(c));

  const cell = (raw: DataRow, key: string, readingClass: ReadingClass | undefined, digits = 1) => {
    if (readingClass === "censored" || readingClass === "outOfRange") {
      const marker = raw._rawData?.[key]
      return (
        <span
          className="rounded px-1.5 py-0.5 text-[10px]"
          style={{ background: `${C.amber}22`, color: C.amber }}
          title={`Sensor reading excluded from statistics: ${READING_LABEL[readingClass]}`}
        >
          {marker ?? READING_LABEL[readingClass]}
        </span>
      )
    }
    const v = raw[key]
    if (typeof v === "number" && Number.isFinite(v)) {
      return <span className="tabular-nums">{v.toFixed(digits)}</span>
    }
    return <span style={{ color: C.muted }}>—</span>
  }

  return (
    <div className={panelCls} style={panelStyle}>
      <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
        Data Table
      </h3>
      <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
        Showing first 10 of {filtered.length} filtered rows. Censored or out-of-range sensor
        readings appear as amber markers with their original source text; they are excluded from all
        statistics above.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: C.line }}>
        <table className="w-max min-w-full border-collapse text-left text-[11px]">
          <thead>
            <tr style={{ background: "#16283a" }}>
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 10).map((r, i) => (
              <tr key={i} className="border-t" style={{ borderColor: C.line }}>
                {testNoCol && (
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.fg }}>
                    {r.testNo ?? `—`}
                  </td>
                )}
                {materialCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.fg }}>
                    {r.material}
                  </td>
                )}
                {thicknessCol && (
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.fg }}>
                    {r.thickness ?? "—"}
                  </td>
                )}
                {o2iCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.blue }}>
                    {cell(rows[r._idx], o2iCol.key, r.readingClasses.o2i)}
                  </td>
                )}
                {o2fCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.amber }}>
                    {cell(rows[r._idx], o2fCol.key, r.readingClasses.o2f)}
                  </td>
                )}
                {coiCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.fg }}>
                    {cell(rows[r._idx], coiCol.key, r.readingClasses.coi, 0)}
                  </td>
                )}
                {cofCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.pink }}>
                    {cell(rows[r._idx], cofCol.key, r.readingClasses.cof, 0)}
                  </td>
                )}
                {co2iCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.fg }}>
                    {cell(rows[r._idx], co2iCol.key, r.readingClasses.co2i, 2)}
                  </td>
                )}
                {co2fCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.green }}>
                    {cell(rows[r._idx], co2fCol.key, r.readingClasses.co2f, 2)}
                  </td>
                )}
                {airVelCol && (
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.fg }}>
                    {r.airVel ?? "—"}
                  </td>
                )}
                {piCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.muted }}>
                    {r.pi ?? "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 10 && (
        <p className="mt-2 text-[11px]" style={{ color: C.muted }}>
          Showing 10 of {filtered.length} rows
        </p>
      )}
    </div>
  )
}
