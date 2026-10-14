// src/collections/datasets.ts
//
// Admin-defined datasets in one file.
//   Datasets        - schema: the admin defines the CSV columns and their types
//   DatasetRows     - the imported rows (JSON keyed by column key) + provenance
//   DatasetImports  - upload a CSV here; it is validated against the columns, then imported
//
// Usage in payload.config.ts:
//   import { datasetCollections } from './collections/datasets'
//   collections: [Users, Media, Papers, ...datasetCollections]
//
// Needs: pnpm add papaparse && pnpm add -D @types/papaparse

import Papa from 'papaparse'
import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
} from 'payload'
import { classifyReading } from '@/lib/combustion'

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

const isAdmin = ({ req }: { req: { user?: unknown } }) => !!req.user

const COLUMN_TYPES = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Integer', value: 'integer' },
  { label: 'True / false', value: 'boolean' },
  { label: 'Date', value: 'date' },
  { label: 'Category (fixed options)', value: 'category' },
]

// Standard fields the dashboard can filter, compare, and rank.
// Linking a column to one means "this column already holds values in this unit".
const CANONICAL_FIELDS = [
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

type Column = {
  label: string
  key: string
  type: 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'category'
  unit?: string | null
  required?: boolean | null
  csvHeader?: string | null
  canonicalField?: string | null
  options?: { value: string }[] | null
}

const slugifyKey = (label: string) => {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return /^[a-z]/.test(s) ? s : `c_${s}`
}

const TRUE = new Set(['true', 'yes', 'y', '1'])
const FALSE = new Set(['false', 'no', 'n', '0'])

type Coerced = { ok: true; value: unknown } | { ok: false; error: string }

function coerce(raw: string, col: Column): Coerced {
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
      return Number.isNaN(t)
        ? { ok: false, error: `"${value}" is not a valid date` }
        : { ok: true, value: new Date(t).toISOString() }
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

const idOf = (rel: unknown) =>
  rel && typeof rel === 'object' ? (rel as { id: number | string }).id : (rel as number | string)

/* ------------------------------------------------------------------ */
/* Datasets: the admin defines the columns                             */
/* ------------------------------------------------------------------ */

export const Datasets: CollectionConfig = {
  slug: 'datasets',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'published', 'rowCount', 'lastImportedAt'],
  },
  access: {
    // Visitors only see published datasets. Admins see everything.
    read: ({ req }) => (req.user ? true : { published: { equals: true } }),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data?.columns) return data

        const keys = new Set<string>()
        const canon = new Set<string>()

        data.columns = data.columns.map((c: Column) => {
          const key = c.key?.trim() || slugifyKey(c.label ?? '')
          if (!key) throw new APIError('Every column needs a label.', 400)
          if (keys.has(key)) throw new APIError(`Duplicate column key "${key}".`, 400)
          keys.add(key)

          if (c.canonicalField) {
            if (canon.has(c.canonicalField))
              throw new APIError(
                `More than one column is mapped to "${c.canonicalField}". Map each standard field once.`,
                400,
              )
            canon.add(c.canonicalField)
          }
          return { ...c, key }
        })
        return data
      },
    ],
    beforeChange: [
      // Once rows exist, block edits that would make them inconsistent with the schema.
      async ({ data, originalDoc, req }) => {
        if (!originalDoc?.id || !data?.columns) return data

        const { totalDocs } = await req.payload.count({
          collection: 'dataset-rows',
          where: { dataset: { equals: originalDoc.id } },
        })
        if (totalDocs === 0) return data

        const next = new Map<string, string>(data.columns.map((c: Column) => [c.key, c.type]))
        for (const old of (originalDoc.columns ?? []) as Column[]) {
          const type = next.get(old.key)
          if (!type)
            throw new APIError(
              `Can't remove column "${old.label}" while the dataset has rows. Delete the rows first (Dataset Rows, filter by this dataset), edit the columns, then import again.`,
              400,
            )
          if (type !== old.type)
            throw new APIError(
              `Can't change the type of "${old.label}" while the dataset has rows. Delete the rows first (Dataset Rows, filter by this dataset), edit the columns, then import again.`,
              400,
            )
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    {
      name: 'papers',
      type: 'relationship',
      relationTo: 'papers',
      hasMany: true,
      admin: { description: 'Papers this dataset comes from or is described in.' },
    },
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Visitors can see this dataset and its rows only when published.' },
    },
    {
      name: 'columns',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Column', plural: 'Columns' },
      admin: {
        description:
          'Define the columns of the CSV you will upload, and the type each holds. Then upload the CSV under Dataset Imports.',
      },
      fields: [
        { name: 'label', type: 'text', required: true },
        {
          name: 'key',
          type: 'text',
          admin: { description: 'Stored field name. Auto-generated from the label if left empty.' },
          validate: (v: string | null | undefined) =>
            !v || /^[a-z][a-z0-9_]*$/.test(v)
              ? true
              : 'Use lowercase letters, numbers, and underscores, starting with a letter.',
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          defaultValue: 'text',
          options: COLUMN_TYPES,
        },
        {
          name: 'unit',
          type: 'text',
          admin: {
            description: 'e.g. %, kPa, cm/s',
            condition: (_, sibling) => sibling?.type === 'number' || sibling?.type === 'integer',
          },
        },
        {
          name: 'options',
          type: 'array',
          labels: { singular: 'Option', plural: 'Options' },
          admin: { condition: (_, sibling) => sibling?.type === 'category' },
          fields: [{ name: 'value', type: 'text', required: true }],
        },
        { name: 'required', type: 'checkbox', defaultValue: false },
        {
          name: 'csvHeader',
          type: 'text',
          admin: { description: 'Header in the CSV, if it differs from the label or key.' },
        },
        {
          name: 'canonicalField',
          type: 'select',
          options: CANONICAL_FIELDS,
          admin: {
            description:
              'Optional. Links this column to a standard dashboard field. Values must already be in that field\u2019s unit.',
          },
        },
      ],
    },
    { name: 'rowCount', type: 'number', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'lastImportedAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
  ],
}

/* ------------------------------------------------------------------ */
/* DatasetRows: the data                                               */
/* ------------------------------------------------------------------ */

export const DatasetRows: CollectionConfig = {
  slug: 'dataset-rows',
  admin: { defaultColumns: ['dataset', 'rowIndex', 'sourcePaper', 'sourcePage'] },
  access: {
    // Rows are public only while their dataset is published.
    read: ({ req }) => (req.user ? true : { 'dataset.published': { equals: true } }),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'dataset', type: 'relationship', relationTo: 'datasets', required: true, index: true },
    { name: 'rowIndex', type: 'number', index: true },
    {
      name: 'data',
      type: 'json',
      required: true,
      admin: { description: 'Values keyed by the dataset\u2019s column keys.' },
    },
    {
      // Original source text for readings that could not be stored as numbers
      // (sensor saturation / out-of-range markers such as ">500" or "OR").
      // The dashboard shows these as censored instead of ordinary blanks.
      name: 'rawData',
      type: 'json',
      admin: {
        description:
          'Original non-numeric source values keyed by column key, e.g. { "final_co": ">500" }. Present only when the stored value is null because the source text was censored.',
      },
    },
    // Provenance: where this row's numbers came from.
    { name: 'sourcePaper', type: 'relationship', relationTo: 'papers' },
    { name: 'sourcePage', type: 'number' },
  ],
}

/* ------------------------------------------------------------------ */
/* DatasetImports: upload a CSV, validate against the columns, import  */
/* ------------------------------------------------------------------ */

const MAX_SHOWN = 10
const BATCH = 50
const norm = (s: string) => s.trim().toLowerCase()

// Validates the CSV against the dataset's columns. Throws (and saves nothing) on any bad value.
const validateCsv: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  if (operation !== 'create') return data

  const file = req.file
  if (!file?.data) throw new APIError('Attach a CSV file.', 400)

  const datasetId = idOf(data.dataset)
  const dataset = await req.payload.findByID({ collection: 'datasets', id: datasetId, depth: 0 })
  const columns = ((dataset as { columns?: unknown }).columns ?? []) as Column[]
  if (columns.length === 0) throw new APIError('Define the dataset columns first.', 400)

  const text = file.data.toString('utf8').replace(/^\uFEFF/, '') // strip Excel's BOM
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h: string) => h.trim(),
  })
  if (parsed.data.length === 0) throw new APIError('The CSV has no data rows.', 400)

  // Match each defined column to a CSV header: csvHeader, then label, then key.
  const headers = parsed.meta.fields ?? []
  const headerFor = new Map<string, string>()
  for (const col of columns) {
    const candidates = [col.csvHeader, col.label, col.key].filter(Boolean).map((s) => norm(s as string))
    const found = headers.find((h: string) => candidates.includes(norm(h)))
    if (found) headerFor.set(col.key, found)
  }

  const missing = columns.filter((c) => c.required && !headerFor.has(c.key)).map((c) => c.label)
  if (missing.length)
    throw new APIError(
      `The CSV is missing required columns: ${missing.join(', ')}. Its headers are: ${headers.join(', ')}.`,
      400,
    )

  const used = new Set(headerFor.values())
  const ignored = headers.filter((h: string) => !used.has(h))

  const rows: Record<string, unknown>[] = []
  const rawRows: (Record<string, string> | null)[] = []
  const problems: string[] = []
  let problemCount = 0

  parsed.data.forEach((raw: Record<string, string>, i: number) => {
    const out: Record<string, unknown> = {}
    const rawOut: Record<string, string> = {}
    for (const col of columns) {
      const header = headerFor.get(col.key)
      const rawText = header ? (raw[header] ?? '') : ''
      const result = coerce(rawText, col)
      if (result.ok) {
        out[col.key] = result.value
      } else if (
        (col.type === 'number' || col.type === 'integer') &&
        rawText.trim() !== '' &&
        // Recognized censored / out-of-range / missing markers are kept as
        // raw text (stored null) so the dashboard can report them instead of
        // silently treating them as ordinary missing values.
        ['censored', 'outOfRange', 'missing'].includes(classifyReading(rawText).kind)
      ) {
        out[col.key] = null
        rawOut[col.key] = rawText.trim()
      } else {
        problemCount++
        if (problems.length < MAX_SHOWN) problems.push(`Row ${i + 2}, ${col.label}: ${result.error}`) // +2 = header row, 1-based
      }
    }
    rows.push(out)
    rawRows.push(Object.keys(rawOut).length ? rawOut : null)
  })

  if (problemCount > 0)
    throw new APIError(
      `Nothing was imported. ${problemCount} value${problemCount === 1 ? '' : 's'} don't match the column types:\n` +
        problems.join('\n') +
        (problemCount > problems.length ? `\n...and ${problemCount - problems.length} more.` : ''),
      400,
    )

  // Hand the validated rows to the afterChange hook.
  req.context.importRows = rows
  req.context.importRawRows = rawRows
  req.context.importReplace = !!data.replace
  req.context.importCheckOnly = !!data.checkOnly

  const note = ignored.length ? ` Ignored CSV columns not defined in the dataset: ${ignored.join(', ')}.` : ''
  return {
    ...data,
    status: data.checkOnly ? 'checked' : 'imported',
    summary: data.checkOnly
      ? `${rows.length} rows are valid. Nothing was imported.${note}`
      : `${rows.length} rows imported.${note}`,
  }
}

// Writes the rows. `req` is passed so a failure rolls back the whole import.
const writeRows: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  const rows = req.context.importRows as Record<string, unknown>[] | undefined
  const rawRows = req.context.importRawRows as (Record<string, string> | null)[] | undefined
  if (operation !== 'create' || !rows || req.context.importCheckOnly) return doc

  const datasetId = idOf(doc.dataset)

  if (req.context.importReplace) {
    await req.payload.delete({
      collection: 'dataset-rows',
      where: { dataset: { equals: datasetId } },
      req,
    })
  }

  const { totalDocs: existing } = await req.payload.count({
    collection: 'dataset-rows',
    where: { dataset: { equals: datasetId } },
    req,
  })

  for (let i = 0; i < rows.length; i += BATCH) {
    await Promise.all(
      rows.slice(i, i + BATCH).map((data, j) =>
        req.payload.create({
          collection: 'dataset-rows',
          data: {
            dataset: datasetId as number,
            rowIndex: existing + i + j + 1,
            data,
            ...(rawRows?.[i + j] ? { rawData: rawRows[i + j] } : {}),
          },
          req,
        }),
      ),
    )
  }

  const { totalDocs } = await req.payload.count({
    collection: 'dataset-rows',
    where: { dataset: { equals: datasetId } },
    req,
  })
  await req.payload.update({
    collection: 'datasets',
    id: datasetId,
    data: { rowCount: totalDocs, lastImportedAt: new Date().toISOString() },
    req,
  })

  return doc
}

export const DatasetImports: CollectionConfig = {
  slug: 'dataset-imports',
  labels: { singular: 'Dataset import', plural: 'Dataset imports' },
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'dataset', 'status', 'summary', 'createdAt'],
    description:
      'Create a new entry, pick the dataset, and upload a CSV. Tick "Check only" to validate without importing.',
  },
  access: { read: isAdmin, create: isAdmin, update: () => false, delete: isAdmin },
  upload: {
    // The file is only read for import. It isn't stored, so no S3 or disk is needed.
    disableLocalStorage: true,
    mimeTypes: ['text/csv', 'application/vnd.ms-excel'],
  },
  hooks: { beforeChange: [validateCsv], afterChange: [writeRows] },
  fields: [
    { name: 'dataset', type: 'relationship', relationTo: 'datasets', required: true },
    {
      name: 'replace',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Delete the dataset\u2019s existing rows before importing.' },
    },
    {
      name: 'checkOnly',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Validate the file and report the result without importing anything.' },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Checked', value: 'checked' },
        { label: 'Imported', value: 'imported' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'summary', type: 'textarea', admin: { readOnly: true } },
  ],
}

export const datasetCollections = [Datasets, DatasetRows, DatasetImports]