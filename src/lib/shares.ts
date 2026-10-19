/**
 * Pure share-of-rows computation, shared by the dataset header bar and the
 * statistics card so both can never disagree about the same grouping.
 *
 * Lives in src/lib (not src/components/util.ts) because it must be importable
 * from client components without pulling in the server-only Payload client.
 */
import type { ColumnType, DataRow } from './types'

/**
 * The minimum a share computation needs from a column. Kept structural rather
 * than `Column` so callers can pass a resolved `ColumnLike` from
 * `resolveBass2Columns` without a cast.
 */
export type ShareColumn = {
  key: string
  label: string
  type?: ColumnType
}

export type Share = {
  label: string
  count: number
  /** Percentage of the rows in scope, 0–100. */
  share: number
  /** True for the aggregated remainder bucket. */
  other?: boolean
}

export type ShareResult = {
  /** Display label of the grouping column, or null when nothing could be grouped. */
  groupLabel: string | null
  /** Rows the shares were computed over. */
  total: number
  shares: Share[]
}

/**
 * Share of rows per distinct value of one column.
 *
 * The top `limit` values are kept and everything else is folded into a single
 * hatched "Other" bucket, so a column with hundreds of distinct values stays
 * readable. Blank and missing values are labelled "(blank)" rather than being
 * dropped, so the shares always sum to 100%.
 */
export function computeShares(
  rows: DataRow[],
  column: ShareColumn | null | undefined,
  options: { limit?: number; blankLabel?: string } = {},
): ShareResult {
  const { limit = 3, blankLabel = '(blank)' } = options

  if (!column || rows.length === 0) {
    return { groupLabel: null, total: rows.length, shares: [] }
  }

  const counts = new Map<string, number>()
  for (const row of rows) {
    const raw = row[column.key]
    const label =
      raw === null || raw === undefined || String(raw).trim() === '' ? blankLabel : String(raw)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const top = sorted.slice(0, limit)
  const rest = sorted.slice(limit).reduce((sum, [, count]) => sum + count, 0)

  const shares: Share[] = top.map(([label, count]) => ({
    label,
    count,
    share: (count / rows.length) * 100,
  }))
  if (rest > 0) {
    shares.push({ label: 'Other', count: rest, share: (rest / rows.length) * 100, other: true })
  }

  return { groupLabel: column.label, total: rows.length, shares }
}
