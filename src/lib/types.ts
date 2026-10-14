/**
 * Shared dataset types — pure TypeScript with no runtime imports, so both
 * server components (which fetch via src/components/util.ts) and client
 * components (which only render) can import them.
 */

export type ColumnType = 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'category'

export type Column = {
  label: string                              // shown in the UI, e.g. "Oxygen"
  key: string                                // stored field name, e.g. "oxygen"
  type: ColumnType
  unit?: string | null                       // numbers only, e.g. "%", "kPa"
  required?: boolean | null                  // empty values are rejected on import
  csvHeader?: string | null                  // CSV header, if it differs from label or key
  canonicalField?: string | null             // link to a standard dashboard field, e.g. "o2Percent"
  options?: { value: string }[] | null       // category columns only: the allowed values
}

export type PaperRef = {
  id: number | string
  title: string
  ntrsId?: string | null
  sourceUrl?: string | null
}

export type DatasetMeta = {
  id: number | string
  name: string
  description?: string | null
  columns: Column[]
  rowCount: number
  lastImportedAt?: string | null
  papers: PaperRef[]
}

// One CSV row, flattened: the dataset's column values sit at the top level,
// provenance sits under underscore keys (column keys can never start with "_").
export type DataRow = {
  _id: number | string
  _index: number | null
  _paper: number | string | null
  _page: number | null
  /** Original source text for readings stored as null (censored/out-of-range markers). */
  _rawData?: Record<string, string> | null
} & Record<string, unknown>

export type DatasetBundle = { dataset: DatasetMeta; rows: DataRow[] }
