'use client'

/**
 * The general Visualization panel: charts derived from whatever columns the
 * dataset actually has, so any dataset (FLEX, CFI-G, a future upload) is
 * visualized rather than shown a dead end.
 *
 * Which charts appear is decided by `resolveGeneralColumns` (src/lib/
 * general-charts.ts): material/fuel, outcome, oxygen, burn time, pressure, and
 * up to two further category breakdowns. Everything is drawn from the raw rows;
 * nothing is invented and rows without a value are skipped, not zero-filled.
 */
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { categoryColumns } from '@/lib/columns'
import type { DataRow, DatasetMeta } from '@/lib/types'
import { C } from '../ui/chart-theme'
import { ChartTooltip, Notice, Panel, StatCard } from './primitives'
import {
  categoryCounts,
  columnTitle,
  distinctValues,
  histogram,
  numericRange,
  resolveGeneralColumns,
  scatter,
} from '@/lib/general-charts'

/** Category columns worth a breakdown chart: at least two values, not too many to read. */
const MAX_CATEGORY_VALUES = 12
const MAX_EXTRA_CATEGORIES = 2

export default function GeneralCharts({ dataset, rows }: { dataset: DatasetMeta; rows: DataRow[] }) {
  const roles = useMemo(() => resolveGeneralColumns(dataset.columns), [dataset.columns])
  const extraCategories = useMemo(() => {
    const used = new Set(
      [roles.material, roles.outcome].map((r) => r.column?.key).filter((k): k is string => !!k),
    )
    return categoryColumns(dataset)
      .filter((c) => !used.has(c.key))
      // Provenance and free-text columns are not measurements: a breakdown of
      // `flags` or `comments` is noise.
      .filter((c) => !/flag|comment|note|raw/i.test(c.key))
      .map((c) => ({ col: c, distinct: distinctValues(rows, c.key) }))
      .filter((c) => c.distinct >= 2 && c.distinct <= MAX_CATEGORY_VALUES)
      .slice(0, MAX_EXTRA_CATEGORIES)
  }, [dataset, rows, roles])

  const materialCounts = useMemo(
    () => (roles.material.column ? categoryCounts(rows, roles.material.column.key) : []),
    [rows, roles],
  )
  const outcomeCounts = useMemo(
    () => (roles.outcome.column ? categoryCounts(rows, roles.outcome.column.key) : []),
    [rows, roles],
  )
  const o2Hist = useMemo(() => (roles.o2.column ? histogram(rows, roles.o2.column.key) : []), [rows, roles])
  const burnHist = useMemo(
    () => (roles.burnTime.column ? histogram(rows, roles.burnTime.column.key) : []),
    [rows, roles],
  )
  const o2Range = useMemo(() => (roles.o2.column ? numericRange(rows, roles.o2.column.key) : null), [rows, roles])
  const o2VsBurn = useMemo(
    () =>
      roles.o2.column && roles.burnTime.column
        ? scatter(rows, roles.o2.column.key, roles.burnTime.column.key, roles.material.column?.key ?? null)
        : { points: [], skipped: 0 },
    [rows, roles],
  )

  const statedOutcomes = useMemo(
    () =>
      roles.outcome.column
        ? rows.filter((r) => r[roles.outcome.column!.key] !== null && r[roles.outcome.column!.key] !== undefined).length
        : 0,
    [rows, roles],
  )

  const materialTitle = columnTitle(roles.material)
  const outcomeTitle = columnTitle(roles.outcome)
  const o2Title = columnTitle(roles.o2)
  const burnTitle = columnTitle(roles.burnTime)

  return (
    <div className="space-y-6">
      {/* Stat cards: what this dataset holds, from its own columns. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tests" value={String(rows.length)} sub="rows in this dataset" accent={C.blue} />
        {materialTitle && (
          <StatCard
            label="Materials / fuels"
            value={String(distinctValues(rows, roles.material.column!.key))}
            sub={materialTitle}
            accent={C.amber}
          />
        )}
        {outcomeTitle && (
          <StatCard
            label="Outcomes stated"
            value={String(statedOutcomes)}
            sub={`of ${rows.length} rows`}
            accent={C.green}
          />
        )}
        {o2Range && (
          <StatCard
            label="Oxygen range"
            value={`${o2Range.min}–${o2Range.max}`}
            sub={`${o2Title} · n=${o2Range.n}`}
            accent={C.pink}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {materialCounts.length > 0 && (
          <CategoryBarChart
            title="Tests by Material / Fuel"
            subtitle={`Rows per value of ${materialTitle}`}
            data={materialCounts}
            total={rows.length}
          />
        )}
        {outcomeCounts.length > 0 && (
          <CategoryBarChart
            title="Outcomes (as recorded)"
            subtitle={`How each test ended, as the table says · ${outcomeTitle}`}
            data={outcomeCounts}
            total={rows.length}
            color={C.amber}
          />
        )}
        {o2Hist.length > 1 && (
          <HistogramChart
            title="Oxygen Distribution"
            subtitle={`Tests per ${o2Title} band`}
            data={o2Hist}
            color={C.amber}
          />
        )}
        {burnHist.length > 1 && (
          <HistogramChart
            title="Burn Time Distribution"
            subtitle={`Tests per ${burnTitle} band`}
            data={burnHist}
            color={C.green}
          />
        )}
        {extraCategories.map(({ col, distinct }) => (
          <CategoryBarChart
            key={col.key}
            title={`Tests by ${col.label}`}
            subtitle={`${distinct} values · rows per value`}
            data={categoryCounts(rows, col.key)}
            total={rows.length}
          />
        ))}
      </div>

      {o2VsBurn.points.length > 0 && (
        <Panel
          title="Oxygen vs Burn Time"
          subtitle={`Each point is one test · ${o2Title} against ${burnTitle}`}
          caveat="A point missing either reading is skipped, not plotted as zero. A scatter shows association, not cause."
        >
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={o2Title ?? 'Oxygen'}
                  stroke={C.muted}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={burnTitle ?? 'Burn time'}
                  stroke={C.muted}
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: C.line }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as { x: number; y: number; label: string }
                    return (
                      <div
                        className="rounded-lg border px-3 py-2 text-[11px] shadow-xl"
                        style={{ borderColor: C.line, background: C.ink }}
                      >
                        {d.label && <div style={{ color: C.fg }}>{d.label}</div>}
                        <div style={{ color: C.accentText }}>{o2Title}: {d.x}</div>
                        <div style={{ color: C.accentText }}>{burnTitle}: {d.y}</div>
                      </div>
                    )
                  }}
                />
                <Scatter data={o2VsBurn.points} fill={C.amber} opacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px]" style={{ color: C.muted }}>
            Showing {o2VsBurn.points.length} of {rows.length} rows
            {o2VsBurn.skipped > 0 ? ` · ${o2VsBurn.skipped} skipped (missing oxygen or burn time)` : ''}.
          </p>
        </Panel>
      )}

      <Notice>
        These charts are drawn from the columns this dataset has, so they describe its recorded
        conditions and outcomes. Oxygen is shown in the unit the table uses — compare datasets only
        after checking the units. Nothing here is a fire-risk rating.
      </Notice>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Charts                                                             */
/* ------------------------------------------------------------------ */

function CategoryBarChart({
  title,
  subtitle,
  data,
  total,
  color = C.blue,
}: {
  title: string
  subtitle: string
  data: { name: string; value: number }[]
  total: number
  color?: string
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
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
              width={110}
            />
            <Tooltip content={<ChartTooltip n={total} unit=" tests" />} />
            <Bar dataKey="value" name="Tests" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

function HistogramChart({
  title,
  subtitle,
  data,
  color,
}: {
  title: string
  subtitle: string
  data: { name: string; value: number }[]
  color: string
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
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
              width={90}
            />
            <Tooltip content={<ChartTooltip unit=" tests" />} />
            <Bar dataKey="value" name="Tests" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}
