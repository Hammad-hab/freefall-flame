"use client";

/**
 * Visualization panel — orchestrator.
 *
 * Owns the column resolution, the material/flow filter state, and the derived
 * chart data. Everything presentational lives in the sibling modules:
 *
 *   chartData.ts      pure derivations (no React)
 *   primitives.tsx    Panel, StatCard, FilterPill, Notice, ChartTooltip
 *   MaterialCharts.tsx  charts grouped by material or investigator
 *   GasCharts.tsx       before/after gas composition + velocity scatter
 *   DataTable.tsx       raw readings with censored markers
 */
import { useMemo, useState } from "react";
import {
  buildRowMapping,
  parseRows,
  resolveBass2Columns,
} from "@/lib/combustion";
import type { DatasetMeta, DataRow } from "@/lib/types";
import { C, panelCls, panelStyle } from "../ui/chart-theme";
import GenericCompare from "./GenericCompare";
import { DataTable } from "./DataTable";
import { FilterPill, Notice, StatCard } from "./primitives";
import type { WorkspaceLinks } from "../workspace/links";
import {
  TestsPerMaterialChart,
  MeanO2ByMaterialChart,
  MeanCoByMaterialChart,
  MeanCo2ByMaterialChart,
  ThicknessDistributionChart,
  PrincipalInvestigatorChart,
  RodDiameterChart,
  OutcomeChart,
} from "./MaterialCharts";
import { GasBeforeAfterChart, VelocityVsO2Chart } from "./GasCharts";
import {
  excludedByMaterial,
  gasByMaterial,
  gasComposition,
  materialDistribution,
  mean,
  outcomeCounts,
  principalInvestigatorBreakdown,
  rodDiameterDistribution,
  summaryStats,
  thicknessDistribution,
  velocityVsO2,
} from "./chartData";

export default function Visualization({
  dataset,
  rows,
  links,
}: {
  dataset: DatasetMeta
  rows: DataRow[];
  /** Links between the Data Table and the sandbox (workspace/links.ts). */
  links?: WorkspaceLinks;
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
  const co2iCol = colOf("co2Initial");
  const co2fCol = colOf("co2Final");
  const airVelCol = colOf("airVelStart");
  const piCol = colOf("pi");
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

  const materialDist = useMemo(() => materialDistribution(filtered), [filtered]);
  const o2ByMaterial = useMemo(() => gasByMaterial(filtered, (r) => r.o2Consumed), [filtered]);
  const coByMaterial = useMemo(() => gasByMaterial(filtered, (r) => r.coProduced), [filtered]);
  const co2ByMaterial = useMemo(() => gasByMaterial(filtered, (r) => r.co2Produced), [filtered]);
  const excluded = useMemo(() => excludedByMaterial(filtered), [filtered]);
  const thicknessDist = useMemo(() => thicknessDistribution(filtered), [filtered]);
  const rodDist = useMemo(() => rodDiameterDistribution(filtered), [filtered]);
  const outcomes = useMemo(() => outcomeCounts(filtered), [filtered]);
  const velVsO2 = useMemo(() => velocityVsO2(filtered), [filtered]);
  const piBreakdown = useMemo(() => principalInvestigatorBreakdown(filtered), [filtered]);
  const gasComp = useMemo(() => gasComposition(filtered), [filtered]);
  const summary = useMemo(() => summaryStats(filtered), [filtered]);

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
        <Notice>
          <span className="font-medium">Column mapping needs attention: </span>
          {warnings.join(" ")}
        </Notice>
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
            {summary.consumed.length > 0 && (
              <StatCard
                label="Mean O₂ consumed"
                value={`${(mean(summary.consumed) ?? 0).toFixed(1)}%`}
                sub={`n=${summary.consumed.length} valid readings`}
                accent={C.amber}
              />
            )}
            {summary.co.length > 0 && (
              <StatCard
                label="Mean CO produced"
                value={`${Math.max(0, Math.round(mean(summary.co) ?? 0))} ppm`}
                sub={`n=${summary.co.length} valid readings`}
                accent={C.pink}
              />
            )}
            {summary.co2.length > 0 && (
              <StatCard
                label="Mean CO₂ produced"
                value={`${(mean(summary.co2) ?? 0).toFixed(2)}%`}
                sub={`n=${summary.co2.length} valid readings`}
                accent={C.green}
              />
            )}
          </div>
          {summary.excluded > 0 && (
            <Notice>
              {summary.excluded} sensor reading{summary.excluded === 1 ? " was" : "s were"} censored,
              out of range, or missing in this selection. Means and maxima above are computed from the
              remaining valid readings only and may be biased low when high readings were excluded.
            </Notice>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Material distribution — sorted bar (replaces the pie chart) */}
            {materialDist.length > 1 && (
              <TestsPerMaterialChart data={materialDist} total={filtered.length} />
            )}

            {/* Gas composition: O₂ on its own scale */}
            {gasComp.o2.length > 0 && o2iCol && o2fCol && (
              <GasBeforeAfterChart
                title="Mean O₂ Before vs After Tests"
                subtitle="Average starting and ending oxygen concentration"
                caveat="Means use valid numeric readings only; censored or missing readings are excluded and counted in the Data Table."
                data={gasComp.o2}
                finalColor={C.amber}
              />
            )}

            {/* Gas composition: CO₂ on its own scale */}
            {gasComp.co2.length > 0 && co2iCol && co2fCol && (
              <GasBeforeAfterChart
                title="Mean CO₂ Before vs After Tests"
                subtitle="Average carbon dioxide concentration"
                caveat="CO₂ changes are much smaller than O₂ changes, so this gas gets its own chart and scale."
                data={gasComp.co2}
                finalColor={C.green}
              />
            )}

            {/* O2 consumed by material */}
            {o2ByMaterial.length > 0 && <MeanO2ByMaterialChart data={o2ByMaterial} excluded={excluded} />}

            {/* CO produced by material */}
            {coByMaterial.length > 0 && <MeanCoByMaterialChart data={coByMaterial} excluded={excluded} />}

            {/* CO2 produced by material */}
            {co2ByMaterial.length > 0 && <MeanCo2ByMaterialChart data={co2ByMaterial} excluded={excluded} />}

            {/* Thickness distribution, and the rods beside it (rods have a diameter, not a thickness) */}
            {thicknessDist.length > 0 && thicknessCol && (
              <ThicknessDistributionChart
                data={thicknessDist}
                unit={thicknessCol.unit ? String(thicknessCol.unit) : "mm"}
                rodsElsewhere={rodDist.reduce((s, d) => s + d.value, 0)}
              />
            )}
            {rodDist.length > 0 && <RodDiameterChart data={rodDist} />}

            {/* NASA's stated outcome: the five codes, with counts (only with an outcome column) */}
            {outcomes.length > 0 && <OutcomeChart data={outcomes} />}

            {/* Starting air velocity vs O2 consumed — explicitly a starting measurement */}
            {velVsO2.length > 2 && airVelCol && <VelocityVsO2Chart data={velVsO2} />}

            {/* PI breakdown */}
            {piBreakdown.length > 1 && piCol && (
              <PrincipalInvestigatorChart data={piBreakdown} total={filtered.length} />
            )}
          </div>

          {/* Data table — shows censored/out-of-range markers instead of hiding them */}
          <DataTable filtered={filtered} rows={rows} resolutions={resolutions} all={parsed} links={links} />
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
      {/*<GenericCompare dataset={dataset} rows={rows} />*/}
    </div>
  );
}
