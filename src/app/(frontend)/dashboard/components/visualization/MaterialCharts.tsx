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
}: {
  data: CountRow[]
  unit: string
}) {
  return (
    <Panel title="Thickness Distribution" subtitle={`Sample thickness ranges (${unit})`}>
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
