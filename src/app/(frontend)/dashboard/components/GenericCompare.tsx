"use client";

import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { numericColumns, categoryColumns, columnLabel } from "@/lib/columns";
import type { DataRow, DatasetMeta } from "@/lib/types";
import { C, CHART_COLORS, panelCls, panelStyle } from "./chart-theme";

/**
 * Generic comparison chart.
 *
 * Works with any uploaded dataset that has at least two numeric columns —
 * no BASS-II-specific fields required. Rows missing either axis value are
 * skipped and counted; unsuitable column types produce a helpful empty state
 * instead of a misleading chart.
 */
export default function GenericCompare({
  dataset,
  rows,
}: {
  dataset: DatasetMeta;
  rows: DataRow[];
}) {
  const numerics = useMemo(() => numericColumns(dataset), [dataset])
  const categories = useMemo(() => categoryColumns(dataset), [dataset])

  const [xKey, setXKey] = useState<string | null>(null)
  const [yKey, setYKey] = useState<string | null>(null)
  const [groupKey, setGroupKey] = useState<string | null>(null)

  // Default to the first two numeric columns once the dataset is known.
  const effectiveX = xKey ?? numerics[0]?.key ?? null
  const effectiveY = yKey ?? numerics[1]?.key ?? null
  const xCol = numerics.find((c) => c.key === effectiveX) ?? null
  const yCol = numerics.find((c) => c.key === effectiveY) ?? null
  const groupCol = categories.find((c) => c.key === groupKey) ?? null

  const groups = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const v = groupCol ? r[groupCol.key] : null
      if (v !== null && v !== undefined && String(v).trim() !== '') set.add(String(v))
    }
    return [...set].sort()
  }, [rows, groupCol])

  const { points, skipped } = useMemo(() => {
    const out: Array<{ x: number; y: number; group: string; label: string }> = []
    let skipped = 0
    for (const r of rows) {
      const x = r[effectiveX ?? '']
      const y = r[effectiveY ?? '']
      const xn = typeof x === 'number' && Number.isFinite(x) ? x : null
      const yn = typeof y === 'number' && Number.isFinite(y) ? y : null
      if (xn === null || yn === null) {
        skipped++
        continue
      }
      const g = groupCol ? String(r[groupCol.key] ?? '') : ''
      out.push({ x: xn, y: yn, group: g || 'All rows', label: '' })
    }
    return { points: out, skipped }
  }, [rows, effectiveX, effectiveY, groupCol])

  const numId = `cmp-${dataset.id}`

  const selectCls =
    'rounded-lg border px-2 py-1.5 text-[11px] bg-[#23232c]'

  // Empty states ----------------------------------------------------------------
  if (numerics.length < 2) {
    return (
      <div className={panelCls} style={panelStyle}>
        <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
          Compare Any Two Measurements
        </h3>
        <p className="mt-3 text-[12px]" style={{ color: C.muted }}>
          This dataset needs at least two numeric columns to compare. It currently has{' '}
          {numerics.length === 0 ? 'none' : `only one (${columnLabel(numerics[0])})`}. Upload a
          dataset with two or more numeric columns to use the generic comparison chart.
        </p>
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className={panelCls} style={panelStyle}>
        <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
          Compare Any Two Measurements
        </h3>
        <p className="mt-3 text-[12px]" style={{ color: C.muted }}>
          This dataset has no rows to plot.
        </p>
      </div>
    )
  }

  return (
    <div className={panelCls} style={panelStyle}>
      <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
        Compare Any Two Measurements
      </h3>
      <p className="mt-1 text-[11px]" style={{ color: C.muted }}>
        Generic comparison — works with any uploaded dataset. Points missing either value are
        skipped, never invented.
      </p>

      <div className="mt-3 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
          X axis
          <select
            value={effectiveX ?? ''}
            onChange={(e) => setXKey(e.target.value || null)}
            className={selectCls}
            style={{ borderColor: C.line, color: C.fg }}
          >
            {numerics.map((c) => (
              <option key={c.key} value={c.key}>
                {columnLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
          Y axis
          <select
            value={effectiveY ?? ''}
            onChange={(e) => setYKey(e.target.value || null)}
            className={selectCls}
            style={{ borderColor: C.line, color: C.fg }}
          >
            {numerics.map((c) => (
              <option key={c.key} value={c.key}>
                {columnLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
          Group by
          <select
            value={groupKey ?? ''}
            onChange={(e) => setGroupKey(e.target.value || null)}
            className={selectCls}
            style={{ borderColor: C.line, color: C.fg }}
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {columnLabel(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {points.length === 0 ? (
        <p className="mt-4 text-[12px]" style={{ color: C.muted }}>
          No rows have both {xCol ? columnLabel(xCol) : 'X'} and {yCol ? columnLabel(yCol) : 'Y'}{' '}
          values. {skipped} row{skipped === 1 ? '' : 's'} skipped.
        </p>
      ) : (
        <>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xCol ? columnLabel(xCol) : 'X'}
                  stroke={C.muted}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yCol ? columnLabel(yCol) : 'Y'}
                  stroke={C.muted}
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: C.line }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div
                        className="rounded-lg border px-3 py-2 text-[11px] shadow-xl"
                        style={{ borderColor: C.line, background: C.ink }}
                      >
                        {groupCol && <div style={{ color: C.fg }}>{d.group}</div>}
                        <div style={{ color: C.blue }}>
                          {xCol ? columnLabel(xCol) : 'X'}: {d.x}
                        </div>
                        <div style={{ color: C.amber }}>
                          {yCol ? columnLabel(yCol) : 'Y'}: {d.y}
                        </div>
                      </div>
                    )
                  }}
                />
                {groupCol ? (
                  <>
                    <Legend wrapperStyle={{ fontSize: '11px', color: C.muted }} />
                    {groups.map((g, i) => (
                      <Scatter
                        key={g}
                        name={g}
                        data={points.filter((p) => p.group === g)}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        opacity={0.75}
                      />
                    ))}
                  </>
                ) : (
                  <Scatter data={points} fill={C.blue} opacity={0.75} />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px]" style={{ color: C.muted }}>
            Showing {points.length} of {rows.length} rows
            {skipped > 0 && ` · ${skipped} skipped (missing axis value)`}. Correlation on a scatter
            plot does not establish causation.
          </p>
        </>
      )}
    </div>
  );
}
