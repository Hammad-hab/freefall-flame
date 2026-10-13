export const COLUMN_TYPES = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Integer', value: 'integer' },
  { label: 'True / false', value: 'boolean' },
  { label: 'Date', value: 'date' },
  { label: 'Category (fixed options)', value: 'category' },
] as const

export type ColumnType = (typeof COLUMN_TYPES)[number]['value']

// The standard fields the dashboard knows how to filter, compare, and rank.
// Mapping a column to one of these means "this column already holds values in this unit".
export const CANONICAL_FIELDS = [
  { label: 'Material / fuel', value: 'material' },
  { label: 'Oxygen (%)', value: 'o2Percent' },
  { label: 'Pressure (kPa)', value: 'pressureKpa' },
  { label: 'Flow velocity (cm/s)', value: 'flowCmS' },
  { label: 'Gravity (g)', value: 'gravityG' },
  { label: 'Outcome', value: 'outcome' },
  { label: 'Spread rate (mm/s)', value: 'spreadRateMmS' },
  { label: 'Burning rate (mm²/s)', value: 'burnRateMm2S' },
  { label: 'Peak temperature (K)', value: 'peakTempK' },
]

export type Column = {
  label: string
  key: string
  type: ColumnType
  unit?: string | null
  required?: boolean | null
  csvHeader?: string | null
  canonicalField?: string | null
  options?: { value: string }[] | null
}

export function slugifyKey(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return /^[a-z]/.test(s) ? s : `c_${s}`
}

export type CoerceResult = { ok: true; value: unknown } | { ok: false; error: string }

const TRUE = new Set(['true', 'yes', 'y', '1'])
const FALSE = new Set(['false', 'no', 'n', '0'])

export function coerce(raw: string, col: Column): CoerceResult {
  const value = (raw ?? '').trim()

  if (value === '') {
    return col.required ? { ok: false, error: 'Required value is empty' } : { ok: true, value: null }
  }

  switch (col.type) {
    case 'text':
      return { ok: true, value }

    case 'number':
    case 'integer': {
      const n = Number(value.replace(/,/g, ''))
      if (Number.isNaN(n)) return { ok: false, error: `"${value}" is not a number` }
      if (col.type === 'integer' && !Number.isInteger(n))
        return { ok: false, error: `"${value}" is not a whole number` }
      return { ok: true, value: n }
    }

    case 'boolean': {
      const v = value.toLowerCase()
      if (TRUE.has(v)) return { ok: true, value: true }
      if (FALSE.has(v)) return { ok: true, value: false }
      return { ok: false, error: `"${value}" is not true/false` }
    }

    case 'date': {
      const t = Date.parse(value)
      if (Number.isNaN(t)) return { ok: false, error: `"${value}" is not a valid date` }
      return { ok: true, value: new Date(t).toISOString() }
    }

    case 'category': {
      const options = (col.options ?? []).map((o) => o.value)
      if (options.length === 0) return { ok: true, value }
      const match = options.find((o) => o.toLowerCase() === value.toLowerCase())
      return match
        ? { ok: true, value: match }
        : { ok: false, error: `"${value}" is not one of: ${options.join(', ')}` }
    }
  }
}