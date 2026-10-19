"use client";

/**
 * Gas-composition charts: before/after means for one gas, and the starting-air
 * velocity scatter.
 *
 * O₂ and CO₂ are plotted as separate panels rather than one shared axis
 * because their scales differ by roughly 40× (O₂ ~20%, CO₂ ~0.5%).
 */
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
import { C } from "../ui/chart-theme";
import { Panel, ChartTooltip } from "./primitives";
import type { GasCompositionRow } from "./chartData";

/* ------------------------------------------------------------------ */
/* Before vs after, one gas                                            */
/* ------------------------------------------------------------------ */

export function GasBeforeAfterChart({
  title,
  subtitle,
  caveat,
  data,
  finalColor,
}: {
  title: string
  subtitle: string
  caveat: string
  data: GasCompositionRow[]
  /** Colour of the "After tests" bar. The "Before tests" bar is always C.blue. */
  finalColor: string
}) {
  return (
    <Panel title={title} subtitle={subtitle} caveat={caveat}>
      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
            <XAxis dataKey="group" stroke={C.muted} fontSize={11} tickLine={false} />
            <YAxis stroke={C.muted} fontSize={11} tickLine={false} unit="%" />
            <Tooltip content={<ChartTooltip unit="%" />} />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              formatter={(v: string) => <span style={{ color: C.fg }}>{v}</span>}
            />
            <Bar dataKey="Initial" name="Before tests (mean)" fill={C.blue} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Final" name="After tests (mean)" fill={finalColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Starting air velocity vs O₂ consumed                                */
/* ------------------------------------------------------------------ */

export function VelocityVsO2Chart({
  data,
}: {
  data: { x: number; y: number; material: string }[]
}) {
  return (
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
            <Scatter data={data} fill={C.amber} opacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}
