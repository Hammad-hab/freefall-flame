/**
 * Infers a dataset's columns from a CSV and creates the Dataset + its rows in Payload.
 *
 *   pnpm payload run src/scripts/import-csv.ts -- path/to/file.csv --name "BASS-II tests" [flags]
 *
 * Flags
 *   --name "..."         Dataset name (default: the file name)
 *   --description "..."  Dataset description
 *   --paper 20210011385  Link the paper with this NTRS ID (must already exist in Papers)
 *   --publish            Make the dataset public (default: unpublished)
 *   --replace            If a dataset with this name exists, delete its rows and redefine it
 *   --blank-junk         Turn non-numeric entries ("none", ">500") in numeric columns into blanks
 *   --dry-run            Print the inferred schema and stop. Nothing is written.
 *
 * If the arguments don't reach the script, set env vars instead: CSV_FILE, DATASET_NAME.
 */
import fs from 'node:fs'
import path from 'node:path'
import Papa from 'papaparse'
import { getPayload } from 'payload'

import config from '../payload.config'
import { coerce, slugifyKey, type Column } from './dataset'

/* ------------------------------ args ------------------------------ */

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const file = argv.find((a) => a.toLowerCase().endsWith('.csv')) ?? process.env.CSV_FILE

/* ---------------------------- inference --------------------------- */

const EMPTY = new Set(['', 'n/a', 'na', 'null', 'nan'])
const isEmpty = (v: string) => EMPTY.has(v.trim().toLowerCase())
const isNum = (v: string) => v.trim() !== '' && Number.isFinite(Number(v.replace(/,/g, '')))
const BOOL = new Set(['true', 'false', 'yes', 'no', 'y', 'n'])
const DATE_RE = /^(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}|\d{4}-\d{2}-\d{2}T)/

type Inferred = Column & { junk: string[]; emptyCount: number; role?: 'measure' | 'label' | 'time' }

function cleanLabel(header: string) {
  let unit: string | null = null
  let label = header.replace(/\s+/g, ' ').trim()

  const paren = label.match(/\(([^)]{1,12})\)\s*$/) // "Initial CO (ppm)"
  if (paren && !/\d{2,}/.test(paren[1])) {
    unit = paren[1].trim()
    label = label.replace(paren[0], '').trim()
  }
  if (/%\s*by\s*vol/i.test(label)) {
    // "O2 % by vol"
    unit = unit ?? '%'
    label = label.replace(/\s*%\s*by\s*vol\w*/i, '').trim()
  }
  return { label: label || header.trim(), unit }
}

function inferColumn(header: string, values: string[]): Inferred {
  const { label, unit } = cleanLabel(header)
  const filled = values.filter((v) => !isEmpty(v)).map((v) => v.trim())
  const emptyCount = values.length - filled.length

  const base = { label, key: slugifyKey(label), csvHeader: header.trim(), emptyCount }
  const roleOf = (): Inferred['role'] =>
    /\b(gmt|date|time|year|day)\b/i.test(header)
      ? 'time'
      : /(\bid\b|\bno\.?|#|\bsample\b|\bnumber\b)/i.test(header)
        ? 'label'
        : 'measure'

  if (filled.length === 0) return { ...base, type: 'text', junk: [], required: false }

  const lower = filled.map((v) => v.toLowerCase())
  const nums = filled.filter(isNum)

  // Numbers (allowing a few junk entries like "none")
  if (nums.length / filled.length >= 0.9) {
    const junk = filled.filter((v) => !isNum(v))
    const integer = nums.every((v) => Number.isInteger(Number(v.replace(/,/g, ''))) && !v.includes('.'))
    return {
      ...base,
      type: integer ? 'integer' : 'number',
      unit,
      junk: [...new Set(junk)],
      required: emptyCount === 0 && junk.length === 0,
      role: roleOf(),
    }
  }

  if (lower.every((v) => BOOL.has(v)))
    return { ...base, type: 'boolean', junk: [], required: emptyCount === 0 }

  if (filled.every((v) => DATE_RE.test(v) && !Number.isNaN(Date.parse(v))))
    return { ...base, type: 'date', junk: [], required: emptyCount === 0, role: 'time' }

  const distinct = [...new Set(filled)]
  if (filled.length >= 5 && distinct.length <= Math.min(12, filled.length / 2))
    return {
      ...base,
      type: 'category',
      options: distinct.sort().map((value) => ({ value })),
      junk: [],
      required: emptyCount === 0,
    }

  return { ...base, type: 'text', junk: [], required: emptyCount === 0 }
}

/* ------------------------------ main ------------------------------ */

async function main() {
  if (!file) throw new Error('Pass a .csv file path (or set CSV_FILE).')
  const name = opt('name') ?? process.env.DATASET_NAME ?? path.basename(file, path.extname(file))
  const blankJunk = flag('blank-junk')

  const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(file, 'utf8'), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h: string) => h.trim(),
  })
  const headers = parsed.meta.fields ?? []
  const data = parsed.data
  if (!data.length) throw new Error('The CSV has no data rows.')

  // Infer, then make keys unique.
  const used = new Set<string>()
  const cols: Inferred[] = headers.map((h: string) => {
    const c = inferColumn(h, data.map((r: Record<string, string>) => r[h] ?? ''))
    let key = c.key
    for (let i = 2; used.has(key); i++) key = `${c.key}_${i}`
    used.add(key)
    return { ...c, key }
  })

  console.log(`\n${file}: ${data.length} rows, ${cols.length} columns\n`)
  console.table(
    cols.map((c) => ({
      key: c.key,
      label: c.label,
      type: c.type,
      unit: c.unit ?? '',
      role: c.role ?? '',
      required: c.required ? 'yes' : '',
      blanks: c.emptyCount || '',
      options: c.options ? c.options.length : '',
      junk: c.junk.length ? c.junk.slice(0, 4).join(' | ') : '',
    })),
  )

  const junkCols = cols.filter((c) => c.junk.length)
  if (junkCols.length && !blankJunk)
    console.log(
      `\n${junkCols.length} numeric column(s) contain non-numbers (see "junk"). ` +
        `Rows with them will fail validation. Re-run with --blank-junk to turn them into blanks, or fix the CSV.\n`,
    )

  // Validate every row against the inferred columns.
  const rows: Record<string, unknown>[] = []
  const errors: string[] = []
  let errorCount = 0
data.forEach((raw: Record<string, string>, i: number) => {
    const out: Record<string, unknown> = {}
    for (const col of cols) {
      let v = raw[col.csvHeader as string] ?? ''
      if (blankJunk && (col.type === 'number' || col.type === 'integer') && !isEmpty(v) && !isNum(v)) v = ''
      const r = coerce(v, col)
      if (r.ok) out[col.key] = r.value
      else {
        errorCount++
        if (errors.length < 20) errors.push(`  row ${i + 2}, ${col.label}: ${r.error}`)
      }
    }
    rows.push(out)
  })

  if (errorCount) {
    console.log(`${errorCount} problem(s). First ${errors.length}:\n${errors.join('\n')}\n`)
    if (!flag('dry-run')) throw new Error('Fix the problems above (or use --blank-junk). Nothing was written.')
  } else {
    console.log('All rows validate.\n')
  }
  if (flag('dry-run')) return console.log('Dry run: nothing written.')

  /* ---- write ---- */
  const payload = await getPayload({ config: await config })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: any[] = cols.map((c) => ({
    label: c.label,
    key: c.key,
    type: c.type,
    unit: c.unit ?? undefined,
    required: !!c.required && !(blankJunk && c.junk.length),
    csvHeader: c.csvHeader,
    options: c.options,
    role: c.role, // ignored unless you added the "role" field to Datasets
  }))

  let papers: (number | string)[] = []
  const ntrsId = opt('paper')
  if (ntrsId) {
    const p = await payload.find({
      collection: 'papers',
      where: { ntrsId: { equals: ntrsId } },
      limit: 1,
      depth: 0,
      draft: true,
    })
    if (p.docs[0]) papers = [p.docs[0].id]
    else console.warn(`No paper with NTRS ID ${ntrsId} found. Continuing without a link.`)
  }

  const existing = await payload.find({
    collection: 'datasets',
    where: { name: { equals: name } },
    limit: 1,
    depth: 0,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: any = {
    name,
    description: opt('description'),
    columns,
    published: flag('publish'),
    ...(papers.length ? { papers } : {}),
  }

  let datasetId: number | string
  if (existing.docs[0]) {
    if (!flag('replace')) throw new Error(`A dataset named "${name}" already exists. Use --replace to overwrite it.`)
    datasetId = existing.docs[0].id
    await payload.delete({ collection: 'dataset-rows', where: { dataset: { equals: datasetId } } })
    await payload.update({ collection: 'datasets', id: datasetId, data: fields })
    console.log(`Replaced dataset "${name}" (id ${datasetId}).`)
  } else {
    const created = await payload.create({ collection: 'datasets', data: fields })
    datasetId = created.id
    console.log(`Created dataset "${name}" (id ${datasetId}).`)
  }

  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    await Promise.all(
      rows.slice(i, i + BATCH).map((d, j) =>
        payload.create({
          collection: 'dataset-rows',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { dataset: datasetId, rowIndex: i + j + 1, data: d } as any,
        }),
      ),
    )
    process.stdout.write(`\rInserted ${Math.min(i + BATCH, rows.length)} / ${rows.length} rows`)
  }

  await payload.update({
    collection: 'datasets',
    id: datasetId,
    data: { rowCount: rows.length, lastImportedAt: new Date().toISOString() },
  })
  console.log(`\nDone. Open /admin to review the columns${flag('publish') ? '' : ' and publish it'}.`)
}

try {
  await main()
  process.exit(0)
} catch (e) {
  console.error(`\n${(e as Error).message}`)
  process.exit(1)
}