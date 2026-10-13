"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  Legend,
} from "recharts";
import type { DatasetMeta, DataRow } from "@/components/util";

// ── Design tokens (match global.css @theme) ────────────────────────────
const C = {
  ink: "#07121c",
  ink2: "#0d1b29",
  line: "#1d3144",
  fg: "#e7eff6",
  muted: "#90a4b6",
  blue: "#4fa3ff",
  amber: "#ffa64d",
};

const PIE_COLORS = ["#4fa3ff", "#ffa64d", "#34d399", "#f472b6", "#a78bfa", "#fbbf24"];

// ── Helpers ────────────────────────────────────────────────────────────

/** Coerce a DataRow value to a finite number, or return null. */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Coerce a DataRow value to a non-empty string. */
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Compute mean of numeric values. */
function mean(vals: number[]): number | null {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Compute standard deviation. */
function stdev(vals: number[]): number | null {
  if (vals.length < 2) return null;
  const m = mean(vals)!;
  const sq = vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1);
  return Math.sqrt(sq);
}

// ── Stat Card ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: C.line, background: C.ink2 }}
    >
      <div className="text-[11px] uppercase tracking-wider" style={{ color: C.muted }}>
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-semibold leading-none"
        style={{ color: accent ?? C.fg }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px]" style={{ color: C.muted }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Filter Pill ────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
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
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-[11px] shadow-xl"
      style={{ borderColor: C.line, background: C.ink }}
    >
      {label && (
        <div className="mb-1 font-medium" style={{ color: C.fg }}>
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? C.fg }}>
          {p.name}: <span className="font-medium">{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function Visualization({
  dataset,
  rows,
}: {
  dataset: DatasetMeta;
  rows: DataRow[];
}) {
  // Resolve columns by canonical field or key heuristics
  const cols = dataset.columns;
  const colByKey = useMemo(() => {
    const m = new Map<string, (typeof cols)[number]>();
    for (const c of cols) m.set(c.key, c);
    return m;
  }, [cols]);

  const colByCanon = useMemo(() => {
    const m = new Map<string, (typeof cols)[number]>();
    for (const c of cols) if (c.canonicalField) m.set(c.canonicalField, c);
    return m;
  }, [cols]);

  // Try to find columns by canonical field, then by key patterns
  const findCol = useMemo(() => {
    return (patterns: string[], canon?: string | null) => {
      if (canon) {
        const c = colByCanon.get(canon);
        if (c) return c;
      }
      for (const p of patterns) {
        const c = colByKey.get(p);
        if (c) return c;
      }
      // Fuzzy: search by label
      for (const p of patterns) {
        const lower = p.toLowerCase();
        const c = cols.find(
          (c) =>
            c.label.toLowerCase().includes(lower) ||
            c.key.toLowerCase().includes(lower),
        );
        if (c) return c;
      }
      return undefined;
    };
  }, [cols, colByKey, colByCanon]);

  // Key columns for combustion datasets
  const materialCol = findCol(["material", "Material", "fuel"], "material");
  const thicknessCol = findCol(["thickness", "Thickness"], "thicknessMm");
  const widthCol = findCol(["width", "Width"], "widthCm");
  const o2InitialCol = findCol(["o2_initial", "initial_o2", "Calibrated initial O2"], "o2Percent");
  const o2FinalCol = findCol(["o2_final", "final_o2", "Calibrated final O2"], "o2Percent");
  const coInitialCol = findCol(["co_initial", "initial_co", "Initial CO"], null);
  const coFinalCol = findCol(["co_final", "final_co", "Final CO"], null);
  const co2InitialCol = findCol(["co2_initial", "initial_co2", "Initial CO2"], null);
  const co2FinalCol = findCol(["co2_final", "final_co2", "Final CO2"], null);
  const airVelCol = findCol(["air_velocity", "Air_Velocity", "flow"], "flowCmS");
  const flowRestCol = findCol(["flow_restrictor", "restrictor"], null);
  const piCol = findCol(["pi", "investigator", "Principle Investigator"], null);
  const testNoCol = findCol(["test_no", "Test No.", "test"], null);
  const dateCol = findCol(["date", "Date"], null);
  const framesCol = findCol(["frames", "Total Frames Shot"], null);

  // Derived numeric values per row
  const parsed = useMemo(() => {
    return rows.map((r, i) => {
      const o2i = o2InitialCol ? num(r[o2InitialCol.key]) : null;
      const o2f = o2FinalCol ? num(r[o2FinalCol.key]) : null;
      const coi = coInitialCol ? num(r[coInitialCol.key]) : null;
      const cof = coFinalCol ? num(r[coFinalCol.key]) : null;
      const co2i = co2InitialCol ? num(r[co2InitialCol.key]) : null;
      const co2f = co2FinalCol ? num(r[co2FinalCol.key]) : null;
      return {
        _idx: i,
        material: materialCol ? str(r[materialCol.key]) ?? "Unknown" : "Unknown",
        thickness: thicknessCol ? num(r[thicknessCol.key]) : null,
        width: widthCol ? num(r[widthCol.key]) : null,
        o2i,
        o2f,
        o2Consumed: o2i !== null && o2f !== null ? o2i - o2f : null,
        coi,
        cof,
        coProduced: coi !== null && cof !== null ? cof - coi : null,
        co2i,
        co2f,
        co2Produced: co2i !== null && co2f !== null ? co2f - co2i : null,
        airVel: airVelCol ? num(r[airVelCol.key]) : null,
        flowRest: flowRestCol ? str(r[flowRestCol.key]) ?? "?" : "?",
        pi: piCol ? str(r[piCol.key]) ?? "?" : "?",
        testNo: testNoCol ? str(r[testNoCol.key]) ?? `#${i + 1}` : `#${i + 1}`,
        date: dateCol ? str(r[dateCol.key]) ?? "" : "",
        frames: framesCol ? num(r[framesCol.key]) : null,
      };
    });
  }, [rows, materialCol, thicknessCol, widthCol, o2InitialCol, o2FinalCol, coInitialCol, coFinalCol, co2InitialCol, co2FinalCol, airVelCol, flowRestCol, piCol, testNoCol, dateCol, framesCol]);

  // Filter state
  const [materialFilter, setMaterialFilter] = useState<string>("All");
  const [flowFilter, setFlowFilter] = useState<string>("All");

  // Distinct values for filters
  const materials = useMemo(
    () => ["All", ...new Set(parsed.map((r) => r.material))],
    [parsed],
  );
  const flows = useMemo(
    () => ["All", ...new Set(parsed.map((r) => r.flowRest))],
    [parsed],
  );

  // Apply filters
  const filtered = useMemo(() => {
    return parsed.filter((r) => {
      if (materialFilter !== "All" && r.material !== materialFilter) return false;
      if (flowFilter !== "All" && r.flowRest !== flowFilter) return false;
      return true;
    });
  }, [parsed, materialFilter, flowFilter]);

  // ── Chart data ──────────────────────────────────────────────────────

  // Material distribution
  const materialDist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filtered) counts.set(r.material, (counts.get(r.material) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // O2 consumed by material
  const o2ByMaterial = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const r of filtered) {
      if (r.o2Consumed === null) continue;
      if (!groups.has(r.material)) groups.set(r.material, []);
      groups.get(r.material)!.push(r.o2Consumed);
    }
    return [...groups.entries()]
      .map(([name, vals]) => ({
        name,
        mean: mean(vals) ?? 0,
        std: stdev(vals) ?? 0,
        n: vals.length,
      }))
      .sort((a, b) => b.mean - a.mean);
  }, [filtered]);

  // CO produced by material
  const coByMaterial = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const r of filtered) {
      if (r.coProduced === null) continue;
      if (!groups.has(r.material)) groups.set(r.material, []);
      groups.get(r.material)!.push(r.coProduced);
    }
    return [...groups.entries()]
      .map(([name, vals]) => ({
        name,
        mean: mean(vals) ?? 0,
        std: stdev(vals) ?? 0,
        n: vals.length,
      }))
      .sort((a, b) => b.mean - a.mean);
  }, [filtered]);

  // CO2 produced by material
  const co2ByMaterial = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const r of filtered) {
      if (r.co2Produced === null) continue;
      if (!groups.has(r.material)) groups.set(r.material, []);
      groups.get(r.material)!.push(r.co2Produced);
    }
    return [...groups.entries()]
      .map(([name, vals]) => ({
        name,
        mean: mean(vals) ?? 0,
        std: stdev(vals) ?? 0,
        n: vals.length,
      }))
      .sort((a, b) => b.mean - a.mean);
  }, [filtered]);

  // Thickness distribution
  const thicknessDist = useMemo(() => {
    const vals = filtered.map((r) => r.thickness).filter((v): v is number => v !== null);
    if (!vals.length) return [];
    const bins = new Map<string, number>();
    for (const v of vals) {
      const key = v < 1 ? "<1" : v < 5 ? "1-5" : v < 10 ? "5-10" : "10+";
      bins.set(key, (bins.get(key) ?? 0) + 1);
    }
    const order = ["<1", "1-5", "5-10", "10+"];
    return order
      .filter((k) => bins.has(k))
      .map((k) => ({ name: k, count: bins.get(k)! }));
  }, [filtered]);

  // Air velocity vs O2 consumed (scatter)
  const velVsO2 = useMemo(() => {
    return filtered
      .filter((r) => r.airVel !== null && r.o2Consumed !== null)
      .map((r) => ({
        x: r.airVel!,
        y: r.o2Consumed!,
        material: r.material,
      }));
  }, [filtered]);

  // PI breakdown
  const piBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filtered) counts.set(r.pi, (counts.get(r.pi) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Gas composition (initial vs final)
  const gasComp = useMemo(() => {
    const o2i = filtered.map((r) => r.o2i).filter((v): v is number => v !== null);
    const o2f = filtered.map((r) => r.o2f).filter((v): v is number => v !== null);
    const co2i = filtered.map((r) => r.co2i).filter((v): v is number => v !== null);
    const co2f = filtered.map((r) => r.co2f).filter((v): v is number => v !== null);
    return [
      { group: "O₂ (%)", Initial: mean(o2i) ?? 0, Final: mean(o2f) ?? 0 },
      { group: "CO₂ (%)", Initial: mean(co2i) ?? 0, Final: mean(co2f) ?? 0 },
    ];
  }, [filtered]);

  // Summary stats
  const allO2Consumed = filtered.map((r) => r.o2Consumed).filter((v): v is number => v !== null);
  const allCoProduced = filtered.map((r) => r.coProduced).filter((v): v is number => v !== null);
  const allCo2Produced = filtered.map((r) => r.co2Produced).filter((v): v is number => v !== null);
  const allThickness = filtered.map((r) => r.thickness).filter((v): v is number => v !== null);
  const allAirVel = filtered.map((r) => r.airVel).filter((v): v is number => v !== null);

  // ── Render ──────────────────────────────────────────────────────────

  // Check if we have enough numeric columns for any chart
  const hasAnyData = filtered.length > 0;

  if (!hasAnyData) {
    return (
      <div
        className="rounded-[22px] border p-6"
        style={{ borderColor: C.line, background: C.ink2 }}
      >
        <h2 className="text-[17px] font-light" style={{ color: C.fg }}>Visualization</h2>
        <p className="mt-4 text-[13px]" style={{ color: C.muted }}>
          This dataset needs at least two numeric columns for visualization.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[17px] font-light" style={{ color: C.fg }}>Visualization</h2>
        <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
          {filtered.length} of {rows.length} rows · {dataset.name}
        </p>
      </div>

      {/* Filters */}
      {(materials.length > 2 || flows.length > 2) && (
        <div className="space-y-3">
          {materials.length > 2 && (
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
                Material
              </div>
              <div className="flex flex-wrap gap-2">
                {materials.map((m) => (
                  <FilterPill
                    key={m}
                    label={m}
                    active={materialFilter === m}
                    onClick={() => setMaterialFilter(m)}
                  />
                ))}
              </div>
            </div>
          )}
          {flows.length > 2 && (
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
                Flow Restrictor
              </div>
              <div className="flex flex-wrap gap-2">
                {flows.map((f) => (
                  <FilterPill
                    key={f}
                    label={f}
                    active={flowFilter === f}
                    onClick={() => setFlowFilter(f)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Tests"
          value={String(filtered.length)}
          sub={materialFilter !== "All" ? `filtered by ${materialFilter}` : "total rows"}
          accent={C.blue}
        />
        {allO2Consumed.length > 0 && (
          <StatCard
            label="Mean O₂ Consumed"
            value={`${(mean(allO2Consumed) ?? 0).toFixed(1)}%`}
            sub={`range ${(Math.min(...allO2Consumed)).toFixed(1)}–${(Math.max(...allO2Consumed)).toFixed(1)}%`}
            accent={C.amber}
          />
        )}
        {allCoProduced.length > 0 && (
          <StatCard
            label="Mean CO Produced"
            value={`${Math.round(mean(allCoProduced) ?? 0)} ppm`}
            sub={`max ${Math.round(Math.max(...allCoProduced))} ppm`}
            accent="#f472b6"
          />
        )}
        {allCo2Produced.length > 0 && (
          <StatCard
            label="Mean CO₂ Produced"
            value={`${(mean(allCo2Produced) ?? 0).toFixed(2)}%`}
            sub={`max ${(Math.max(...allCo2Produced)).toFixed(1)}%`}
            accent="#34d399"
          />
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Material Distribution */}
        {materialDist.length > 1 && (
          <div
            className="rounded-[22px] border p-5"
            style={{ borderColor: C.line, background: C.ink2 }}
          >
            <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
              Material Distribution
            </h3>
            <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
              Number of tests per material
            </p>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={materialDist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {materialDist.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: C.muted }}
                    formatter={(v: string) => <span style={{ color: C.fg }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Gas Composition: Initial vs Final */}
        {gasComp.length > 0 && (
          <div
            className="rounded-[22px] border p-5"
            style={{ borderColor: C.line, background: C.ink2 }}
          >
            <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
              Gas Composition: Initial vs Final
            </h3>
            <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
              Mean gas concentration before and after testing
            </p>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gasComp} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis
                    dataKey="name"
                    stroke={C.muted}
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis stroke={C.muted} fontSize={11} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px" }}
                    formatter={(v: string) => <span style={{ color: C.fg }}>{v}</span>}
                  />
                  <Bar dataKey="Initial" fill={C.blue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Final" fill={C.amber} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* O2 Consumed by Material */}
        {o2ByMaterial.length > 0 && (
          <div
            className="rounded-[22px] border p-5"
            style={{ borderColor: C.line, background: C.ink2 }}
          >
            <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
              Mean O₂ Consumed by Material
            </h3>
            <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
              Average oxygen consumed during combustion tests
            </p>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={o2ByMaterial} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={C.muted}
                    fontSize={11}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="mean" name="Mean O₂ Consumed (%)" fill={C.amber} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CO Produced by Material */}
        {coByMaterial.length > 0 && (
          <div
            className="rounded-[22px] border p-5"
            style={{ borderColor: C.line, background: C.ink2 }}
          >
            <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
              Mean CO Produced by Material
            </h3>
            <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
              Carbon monoxide generated during combustion
            </p>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coByMaterial} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={C.muted}
                    fontSize={11}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="mean" name="Mean CO Produced (ppm)" fill="#f472b6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CO2 Produced by Material */}
        {co2ByMaterial.length > 0 && (
          <div
            className="rounded-[22px] border p-5"
            style={{ borderColor: C.line, background: C.ink2 }}
          >
            <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
              Mean CO₂ Produced by Material
            </h3>
            <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
              Carbon dioxide generated during combustion
            </p>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={co2ByMaterial} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={C.muted}
                    fontSize={11}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="mean" name="Mean CO₂ Produced (%)" fill="#34d399" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Thickness Distribution */}
        {thicknessDist.length > 0 && (
          <div
            className="rounded-[22px] border p-5"
            style={{ borderColor: C.line, background: C.ink2 }}
          >
            <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
              Thickness Distribution
            </h3>
            <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
              Sample thickness ranges (mm)
            </p>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={thicknessDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis
                    dataKey="name"
                    stroke={C.muted}
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis stroke={C.muted} fontSize={11} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Tests" fill={C.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Air Velocity vs O2 Consumed */}
        {velVsO2.length > 2 && (
          <div
            className="rounded-[22px] border p-5"
            style={{ borderColor: C.line, background: C.ink2 }}
          >
            <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
              Air Velocity vs O₂ Consumed
            </h3>
            <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
              Relationship between airflow and oxygen consumption
            </p>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Air Velocity (cm/s)"
                    stroke={C.muted}
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="O₂ Consumed (%)"
                    stroke={C.muted}
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div
                          className="rounded-lg border px-3 py-2 text-[11px] shadow-xl"
                          style={{ borderColor: C.line, background: C.ink }}
                        >
                          <div style={{ color: C.fg }}>{d.material}</div>
                          <div style={{ color: C.blue }}>Velocity: {d.x} cm/s</div>
                          <div style={{ color: C.amber }}>O₂ Consumed: {d.y.toFixed(1)}%</div>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={velVsO2} fill={C.amber} opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* PI Breakdown */}
        {piBreakdown.length > 1 && (
          <div
            className="rounded-[22px] border p-5"
            style={{ borderColor: C.line, background: C.ink2 }}
          >
            <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
              Tests by Principal Investigator
            </h3>
            <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
              Number of experiments per researcher
            </p>
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={piBreakdown} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={C.muted}
                    fontSize={11}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Tests" fill={C.blue} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div
        className="rounded-[22px] border p-5"
        style={{ borderColor: C.line, background: C.ink2 }}
      >
        <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
          Data Table
        </h3>
        <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
          Showing first 10 of {filtered.length} rows
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: C.line }}>
          <table className="w-max min-w-full border-collapse text-left text-[11px]">
            <thead style={{ background: "#16283a" }}>
              <tr>
                {testNoCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {testNoCol.label}
                  </th>
                )}
                {materialCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {materialCol.label}
                  </th>
                )}
                {thicknessCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {thicknessCol.label}
                  </th>
                )}
                {o2InitialCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {o2InitialCol.label}
                  </th>
                )}
                {o2FinalCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {o2FinalCol.label}
                  </th>
                )}
                {coInitialCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {coInitialCol.label}
                  </th>
                )}
                {coFinalCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {coFinalCol.label}
                  </th>
                )}
                {co2InitialCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {co2InitialCol.label}
                  </th>
                )}
                {co2FinalCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {co2FinalCol.label}
                  </th>
                )}
                {airVelCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {airVelCol.label}
                  </th>
                )}
                {piCol && (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                    {piCol.label}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 10).map((r) => (
                <tr
                  key={r._idx}
                  className="border-t transition-colors hover:bg-white/[0.02]"
                  style={{ borderColor: C.line }}
                >
                  {testNoCol && (
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.fg }}>
                      {r.testNo}
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
                  {o2InitialCol && (
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.blue }}>
                      {r.o2i !== null ? r.o2i.toFixed(1) : "—"}
                    </td>
                  )}
                  {o2FinalCol && (
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.amber }}>
                      {r.o2f !== null ? r.o2f.toFixed(1) : "—"}
                    </td>
                  )}
                  {coInitialCol && (
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.fg }}>
                      {r.coi !== null ? Math.round(r.coi) : "—"}
                    </td>
                  )}
                  {coFinalCol && (
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: "#f472b6" }}>
                      {r.cof !== null ? Math.round(r.cof) : "—"}
                    </td>
                  )}
                  {co2InitialCol && (
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.fg }}>
                      {r.co2i !== null ? r.co2i.toFixed(2) : "—"}
                    </td>
                  )}
                  {co2FinalCol && (
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: "#34d399" }}>
                      {r.co2f !== null ? r.co2f.toFixed(2) : "—"}
                    </td>
                  )}
                  {airVelCol && (
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.fg }}>
                      {r.airVel !== null ? r.airVel : "—"}
                    </td>
                  )}
                  {piCol && (
                    <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.muted }}>
                      {r.pi}
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
    </div>
  );
}
