"use client";

/**
 * Charts that break the selection down by material or by investigator.
 *
 * Each component is a thin wrapper around one recharts panel; all of the
 * numbers come from `./chartData`, so nothing here recomputes anything.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { C } from "../ui/chart-theme";
import { Panel, ChartTooltip } from "./primitives";
import type { CountRow, GasByMaterialRow } from "./chartData";

/* ------------------------------------------------------------------ */
/* Tests per material                                                  */
/* ------------------------------------------------------------------ */

export function TestsPerMaterialChart({
  data,
  total,
}: {
  data: CountRow[]
  total: number
}) {
  return (
    <Panel title="Tests per Material" subtitle="Number of tests for each material in the selection">
      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
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
            <Tooltip content={<ChartTooltip n={total} unit=" tests" />} />
            <Bar dataKey="value" name="Tests" fill={C.blue} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Mean gas produced/consumed per material                             */
/* ------------------------------------------------------------------ */

/**
 * One vertical bar chart of a per-material mean. The tooltip carries the sample
 * size (n) and how many readings for that material were excluded, so a mean
 * backed by two tests never looks as solid as one backed by two hundred.
 */
function MeanGasByMaterialChart({
  title,
  subtitle,
  barName,
  data,
  color,
  unit,
  axisUnit,
  excluded,
}: {
  title: string
  subtitle: string
  /** Legend/tooltip label for the bar series. */
  barName: string
  data: GasByMaterialRow[]
  color: string
  unit: string
  axisUnit?: string
  excluded: Map<string, number>
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
            <XAxis
              type="number"
              stroke={C.muted}
              fontSize={11}
              tickLine={false}
              unit={axisUnit}
            />
            <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={11} tickLine={false} width={80} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as { n: number }
                const ex = excluded.get(label as string) ?? 0
                return (
                  <ChartTooltip
                    active={active}
                    payload={payload}
                    label={label}
                    n={d.n}
                    excluded={ex}
                    unit={unit}
                  />
                )
              }}
            />
            <Bar dataKey="mean" name={barName} fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

export function MeanO2ByMaterialChart({
  data,
  excluded,
}: {
  data: GasByMaterialRow[]
  excluded: Map<string, number>
}) {
  return (
    <MeanGasByMaterialChart
      title="Mean O₂ Consumed by Material"
      subtitle="Starting O₂ minus ending O₂, averaged per material"
      barName="Mean O₂ consumed (%)"
      data={data}
      color={C.amber}
      unit="%"
      axisUnit="%"
      excluded={excluded}
    />
  )
}

export function MeanCoByMaterialChart({
  data,
  excluded,
}: {
  data: GasByMaterialRow[]
  excluded: Map<string, number>
}) {
  return (
    <MeanGasByMaterialChart
      title="Mean CO Produced by Material"
      subtitle="Carbon monoxide generated during combustion"
      barName="Mean CO produced (ppm)"
      data={data}
      color={C.pink}
      unit=" ppm"
      excluded={excluded}
    />
  )
}

export function MeanCo2ByMaterialChart({
  data,
  excluded,
}: {
  data: GasByMaterialRow[]
  excluded: Map<string, number>
}) {
  return (
    <MeanGasByMaterialChart
      title="Mean CO₂ Produced by Material"
      subtitle="Carbon dioxide generated during combustion"
      barName="Mean CO₂ produced (%)"
      data={data}
      color={C.green}
      unit="%"
      axisUnit="%"
      excluded={excluded}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Thickness distribution                                              */
/* ------------------------------------------------------------------ */

export function ThicknessDistributionChart({
  data,
  unit,
  rodsElsewhere = 0,
}: {
  data: CountRow[]
  unit: string
  /** Rods have a diameter, not a thickness; say how many are in the rod chart instead. */
  rodsElsewhere?: number
}) {
  const n = data.reduce((s, d) => s + d.value, 0)
  return (
    <Panel
      title="Thickness Distribution"
      subtitle={`Sample thickness ranges (${unit}), ${n} tests${rodsElsewhere ? `; the ${rodsElsewhere} rods are in the rod-diameter chart` : ''}`}
    >
      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
            <XAxis dataKey="name" stroke={C.muted} fontSize={11} tickLine={false} />
            <YAxis stroke={C.muted} fontSize={11} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip unit=" tests" />} />
            <Bar dataKey="value" name="Tests" fill={C.blue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Rod diameters (rods have no thickness in the cleaned table)         */
/* ------------------------------------------------------------------ */

export function RodDiameterChart({ data }: { data: CountRow[] }) {
  const n = data.reduce((s, d) => s + d.value, 0)
  return (
    <Panel title="Rod Diameters" subtitle={`PMMA rods by diameter (mm), ${n} tests`}>
      <div className="mt-4 h-[220px]" data-chart="rod-diameter">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
            <XAxis dataKey="name" stroke={C.muted} fontSize={11} tickLine={false} />
            <YAxis stroke={C.muted} fontSize={11} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip unit=" tests" />} />
            <Bar dataKey="value" name="Tests" fill={C.blue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* NASA's stated outcome (the five codes, with counts)                 */
/* ------------------------------------------------------------------ */

export function OutcomeChart({ data }: { data: (CountRow & { code: string })[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const stated = data.filter((d) => d.code !== 'not_stated').reduce((s, d) => s + d.value, 0)
  return (
    <Panel title="NASA's Stated Outcome" subtitle={`How each test ended, as NASA's table says: stated for ${stated} of ${total} tests`}>
      <div className="mt-4 h-[220px]" data-chart="outcome">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
            <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={11} tickLine={false} width={130} />
            <Tooltip content={<ChartTooltip unit=" tests" />} />
            <Bar dataKey="value" name="Tests" fill={C.amber} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-x-4 text-[11px] @md:grid-cols-2" data-outcome-counts>
        {data.map((d) => (
          <li key={d.code} className="flex justify-between gap-2" style={{ color: C.fg }}>
            <span style={{ color: C.muted }}>{d.name}</span>
            <span className="tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Tests per principal investigator                                    */
/* ------------------------------------------------------------------ */

export function PrincipalInvestigatorChart({
  data,
  total,
}: {
  data: CountRow[]
  total: number
}) {
  return (
    <Panel title="Tests by Principal Investigator" subtitle="Number of experiments per researcher">
      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
            <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              stroke={C.muted}
              fontSize={11}
              tickLine={false}
              width={120}
            />
            <Tooltip content={<ChartTooltip n={total} unit=" tests" />} />
            <Bar dataKey="value" name="Tests" fill={C.blue} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}
