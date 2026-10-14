/**
 * Pure column helpers for building charts and filters from a dataset.
 * No `server-only` import: client components need these too.
 */
import type { Column, ColumnType, DataRow, DatasetMeta } from './types'

export function getColumn(dataset: DatasetMeta, key: string): Column | undefined {
  return dataset.columns.find((c) => c.key === key)
}

export function columnsOfType(dataset: DatasetMeta, ...types: ColumnType[]): Column[] {
  return dataset.columns.filter((c) => types.includes(c.type))
}

/** Columns that make sense on a chart axis. */
export const numericColumns = (d: DatasetMeta) => columnsOfType(d, 'number', 'integer')

/** Columns that make sense as a filter or group-by. */
export const categoryColumns = (d: DatasetMeta) => columnsOfType(d, 'category', 'text', 'boolean')

/** Axis label such as "Oxygen (%)". */
export function columnLabel(col: Column): string {
  return col.unit ? `${col.label} (${col.unit})` : col.label
}

/** Numbers from one column, with blanks and non-numbers dropped. */
export function numericValues(rows: DataRow[], key: string): number[] {
  const out: number[] = []
  for (const r of rows) {
    const v = r[key]
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v)
  }
  return out
}
