import { notFound } from 'next/navigation'

import {
  getDataset,
  getAllRows,
  categoryColumns,
  numericColumns,
  columnLabel,
  type DataRow,
} from '@/components/util'

const hatch =
  'bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.14)_0px,rgba(255,255,255,0.14)_1px,transparent_1px,transparent_5px)]'

const PILL_STYLES = ['bg-flame-amber text-[#1a0f05]', 'bg-fg text-ink', 'bg-line text-fg']

type Props = {
  datasetId: number | string
  /** Column key to split the pills by. Default: first category column with 2 to 12 distinct values. */
  groupKey?: string
  /** Column key for the mean and range stat. Default: first numeric column. */
  metricKey?: string
  /** Narrow everything to rows where column `key` equals `value`. Enables the comparison chips. */
  filter?: { key: string; value: string }
}

type Stat = {
  n: string
  label: string
  sub?: string
  chip?: { text: string; dir?: 'up' | 'down' }
}

const nums = (rows: DataRow[], key: string) =>
  rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

const fmt = (n: number, integer = false) =>
  integer ? Math.round(n).toLocaleString() : Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1)

export default async function TopStats({ datasetId, groupKey, metricKey, filter }: Props) {
  const dataset = await getDataset(datasetId)
  // if (!dataset) notFound() // missing or unpublished

  const all = await getAllRows(datasetId) // safe: the dataset was confirmed published above
  const rows = filter ? all.filter((r) => String(r[filter.key] ?? '') === filter.value) : all

  /* ---------------------------- pills ---------------------------- */
  const distinct = (key: string) => new Set(rows.map((r) => String(r[key] ?? ''))).size

  const group = groupKey
    ? dataset?.columns.find((c) => c.key === groupKey)
    : categoryColumns(dataset!).find((c) => {
        const d = distinct(c.key)
        return d >= 2 && d <= 12
      })

  let pills: { label: string; count: number; share: number; other?: boolean }[] = []
  if (group && rows.length) {
    const counts = new Map<string, number>()
    for (const r of rows) {
      const v = r[group.key]
      const k = v === null || v === undefined || v === '' ? '(blank)' : String(v)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 3)
    const rest = sorted.slice(3).reduce((s, [, c]) => s + c, 0)
    pills = top.map(([label, count]) => ({ label, count, share: (count / rows.length) * 100 }))
    if (rest > 0) pills.push({ label: 'Other', count: rest, share: (rest / rows.length) * 100, other: true })
  }

  /* ---------------------------- stats ---------------------------- */
  const metric = metricKey
    ? dataset?.columns.find((c) => c.key === metricKey)
    : numericColumns(dataset!)[0]

  const stats: Stat[] = [
    {
      n: rows.length.toLocaleString(),
      label: filter ? 'Rows in selection' : 'Rows',
      // share of the whole dataset, only meaningful when filtered
      chip: filter && all.length ? { text: `${Math.round((rows.length / all.length) * 100)}%` } : undefined,
    },
  ]

  if (group && rows.length) {
    stats.push({ n: String(distinct(group.key)), label: `${group.label} groups` })
  }

  if (metric && rows.length) {
    const vals = nums(rows, metric.key)
    const m = mean(vals)
    if (m !== null) {
      const integer = metric.type === 'integer'
      const fullMean = filter ? mean(nums(all, metric.key)) : null
      const delta = fullMean ? ((m - fullMean) / Math.abs(fullMean)) * 100 : null

      stats.push({
        n: fmt(m, integer),
        label: `Mean ${columnLabel(metric)}`,
        sub: `range ${fmt(Math.min(...vals), integer)} to ${fmt(Math.max(...vals), integer)} · ${vals.length} of ${rows.length} rows have a value`,
        chip:
          delta !== null && Number.isFinite(delta)
            ? {
                text: `${delta > 0 ? '+' : ''}${Math.round(delta)}%`,
                dir: delta >= 0 ? 'up' : 'down',
              }
            : undefined,
      })
    }
  }

  /* ----------------------------- view ---------------------------- */
  return (
    <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
      <div className="min-w-[280px] flex-1">
        <h1 className="font-display text-[28px] font-light tracking-tight">
          {dataset?.name}
          {filter && (
            <span className="text-flame-blue">
              {' '}
              · {filter.value}
            </span>
          )}
        </h1>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            {filter ? 'No rows match this filter.' : 'No rows have been imported yet.'}
          </p>
        ) : (
          pills.length > 0 && (
            <>
              <div className="mt-4 flex max-w-[560px] gap-2">
                {pills.map((p, i) => (
                  <div
                    key={p.label}
                    style={{ flexGrow: Math.max(p.share, 8), flexBasis: 0, minWidth: 76 }}
                    title={`${p.count} of ${rows.length} rows`}
                  >
                    <div className="mb-2 truncate px-1.5 text-[12px] text-muted">{p.label}</div>
                    <div
                      className={`flex h-9 items-center rounded-full px-3.5 text-[12px] ${
                        p.other ? `bg-line text-muted ${hatch}` : PILL_STYLES[i]
                      }`}
                    >
                      {Math.round(p.share)}%
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 px-1.5 text-[11px] text-muted">Share of rows by {group!.label}</p>
            </>
          )
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-6 pr-1">
          {stats.map((s) => (
            <div key={s.label} className="max-w-[220px]">
              <div className="flex items-center gap-1">
                {s.chip && (
                  <div className="relative">
                    {s.chip.dir && (
                      <span
                        className={`absolute -top-2 -left-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] text-ink ${
                          s.chip.dir === 'up' ? 'bg-flame-amber' : 'bg-flame-blue'
                        }`}
                        aria-hidden
                      >
                        {s.chip.dir === 'up' ? '↗' : '↘'}
                      </span>
                    )}
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-[9px] font-medium text-ink"
                      title={s.chip.dir ? 'Selection vs. whole dataset' : 'Share of whole dataset'}
                    >
                      {s.chip.text}
                    </span>
                  </div>
                )}
                <span
                  className={`font-display leading-none font-extralight tracking-tight ${
                    s.n.length > 6 ? 'text-[34px]' : 'text-[48px]'
                  }`}
                >
                  {s.n}
                </span>
              </div>
              <div className="mt-2 text-[12px] text-fg/80">{s.label}</div>
              {s.sub && <div className="mt-0.5 text-[11px] text-muted">{s.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}