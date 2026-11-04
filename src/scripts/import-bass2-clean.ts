/**
 * Imports nasa-project/data/bass2_tests_clean.csv as a NEW dataset,
 * "BASS-II (cleaned)", UNPUBLISHED. Nothing existing is changed.
 *
 *   pnpm payload run src/scripts/import-bass2-clean.ts -- [--write | --check] [--csv path]
 *
 *   (no flag)  dry run: check all rows against the columns below, print the
 *              summary and the checks. Writes nothing.
 *   --write    the same checks, then create the dataset (unpublished) and its
 *              129 rows in one transaction. Refuses if the name exists.
 *   --check    read the dataset back from the database and run the checks.
 *
 * Why a script and not the admin CSV import: the columns are written out here
 * (not guessed), with the keys the dashboard already reads (lib/combustion.ts
 * resolveBass2Columns), and the dates are stored at 12:00 UTC so no time zone
 * shows the wrong day. See data/README-bass2-clean.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import Papa from 'papaparse'
import { commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction } from 'payload'

import config from '../payload.config'
import { coerce, type Column } from './dataset'

const NAME = 'BASS-II (cleaned)'
const DESCRIPTION =
  'NASA BASS-II (PSI-25) test table, cleaned: 129 tests, one row each. Nothing was invented: every value comes ' +
  'from the source row, the *_raw columns keep the original text, and the flags column lists every problem found. ' +
  'Implausible final O2 readings (1.6, 0.6, 0.9, 39.1, 40.4) are blank. "not_stated" outcome means the table does ' +
  'not say how the test ended, not that it burned to completion. Source: PSI-25 experimental table; units and set-up ' +
  'from Olson et al. 2015 (ICES-2015-196, NTRS 20150019858).'
const DEFAULT_CSV = path.resolve(process.cwd(), '..', 'data', 'bass2_tests_clean.csv')
const PAPER_FOR_ROWS = '20150019858' // Olson et al. 2015: the clean table's source for units and set-up
const PAPERS_FOR_DATASET = ['20210011385', '20150019858']

// [csv header, key, label, type, unit, canonical field, options, required]
type Def = [string, string, string, Column['type'], string | null, string | null, string[] | null, boolean]
const DEFS: Def[] = [
  ['test_id', 'test_no', 'Test No.', 'text', null, null, null, true],
  ['investigator', 'principle_investigator', 'Investigator', 'category', null, null,
    ['Bhattacharjee', 'Ferkul', 'Fernandez-Pello', 'Miller', 'Olson', "T'ien"], true],
  ['date', 'date', 'Date', 'date', null, null, null, true],
  ['gmt_day', 'gmt_day', 'GMT day', 'integer', null, null, null, true],
  ['sample_id', 'sample_id', 'Sample ID', 'text', null, null, null, false],
  ['fuel_material', 'material', 'Material', 'category', null, 'material', ['PMMA', 'SIBAL fabric', 'Nomex fabric', 'Wax'], true],
  ['geometry', 'geometry', 'Geometry', 'category', null, null,
    ['film', 'slab', 'rod', 'fabric sheet', 'spherical section', 'candle'], true],
  ['thickness_mm', 'thickness', 'Thickness', 'number', 'mm', null, null, false],
  ['width_cm', 'width_cm', 'Width', 'number', 'cm', null, null, false],
  ['rod_diameter_mm', 'rod_diameter_mm', 'Rod diameter', 'number', 'mm', null, null, false],
  ['rod_colour', 'rod_colour', 'Rod colour', 'category', null, null, ['clear', 'black'], false],
  ['burn_sides', 'burn_sides', 'Burn sides', 'category', null, null, ['one', 'two'], false],
  ['flow_restrictor', 'flow_restrictor', 'Flow restrictor', 'integer', null, null, null, true],
  ['air_steps', 'air_steps', 'Air readings in order', 'text', null, null, null, false],
  ['air_start', 'air_velocity_start', 'Starting air velocity', 'number', 'cm/s', 'flowCmS', null, false],
  ['air_min', 'air_min', 'Lowest air velocity', 'number', 'cm/s', null, null, false],
  ['air_max', 'air_max', 'Highest air velocity', 'number', 'cm/s', null, null, false],
  ['air_last_listed', 'air_last_listed', 'Last listed air velocity', 'number', 'cm/s', null, null, false],
  ['air_trend_after_last', 'air_trend_after_last', 'Air trend after the last reading', 'category', null, null, ['falling', 'rising'], false],
  ['outcome', 'outcome', 'Outcome', 'category', null, 'outcome',
    ['not_stated', 'extinguished_low_flow', 'blowoff_high_flow', 'no_ignition', 'not_sustained'], true],
  ['o2_initial_pct', 'calibrated_initial_o2', 'Initial O2', 'number', '%', 'o2Percent', null, true],
  ['o2_final_pct', 'calibrated_final_o2', 'Final O2', 'number', '%', null, null, false],
  ['o2_drop_pct', 'o2_drop', 'O2 drop', 'number', '%', null, null, false],
  ['co2_initial_pct', 'initial_co2', 'Initial CO2', 'number', '%', null, null, false],
  ['co2_final_pct', 'final_co2', 'Final CO2', 'number', '%', null, null, false],
  ['co2_rise_pct', 'co2_rise', 'CO2 rise', 'number', '%', null, null, false],
  ['co_initial_ppm', 'initial_co', 'Initial CO', 'number', 'ppm', null, null, false],
  ['co_final_ppm', 'final_co', 'Final CO', 'number', 'ppm', null, null, false],
  ['co_rise_ppm', 'co_rise', 'CO rise', 'number', 'ppm', null, null, false],
  ['co2_made_per_o2_used', 'co2_per_o2_used', 'CO2 made per O2 used', 'number', null, null, null, false],
  ['co_as_pct_of_co2', 'co_pct_of_co2', 'CO as a share of the CO2 rise', 'number', '%', null, null, false],
  ['flags', 'flags', 'Flags', 'text', null, null, null, false],
  ['fuel_raw', 'fuel_raw', 'Sample (source text)', 'text', null, null, null, false],
  ['fan_raw', 'fan_raw', 'Fan display (source text)', 'text', null, null, null, false],
  ['air_raw', 'air_raw', 'Air display (source text)', 'text', null, null, null, false],
]
const COLUMNS: (Column & { csvHeader: string })[] = DEFS.map(([csvHeader, key, label, type, unit, canonicalField, options, required]) => ({
  label, key, type, csvHeader, required,
  ...(unit ? { unit } : {}),
  ...(canonicalField ? { canonicalField } : {}),
  ...(options ? { options: options.map((value) => ({ value })) } : {}),
}))

// Readings the source had as text ("none", ">500", "OR", "over"): the clean
// table blanks them and says so in `flags`. Keep that text in rawData so the
// dashboard can still count censored readings.
const FLAG_TO_KEY: Record<string, string> = {
  'initial O2': 'calibrated_initial_o2', 'final O2': 'calibrated_final_o2',
  'initial CO2': 'initial_co2', 'final CO2': 'final_co2',
  'initial CO': 'initial_co', 'final CO': 'final_co',
}
function rawFromFlags(flags: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of flags.matchAll(/(initial|final) (O2|CO2|CO) not numeric in source \("([^"]*)"\)/g)) {
    out[FLAG_TO_KEY[`${m[1]} ${m[2]}`]] = m[3]
  }
  return out
}

/** "2/19/2014" -> "2014-02-19T12:00:00.000Z": noon UTC is the same calendar day in every time zone. */
function isoNoon(mdy: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdy.trim())
  if (!m) return null
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}T12:00:00.000Z`
}

type Row = { data: Record<string, unknown>; rawData: Record<string, string> | null }

function buildRows(csvPath: string): { rows: Row[]; problems: string[] } {
  const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
  })
  const problems: string[] = []
  const headers = parsed.meta.fields ?? []
  const missing = COLUMNS.filter((c) => !headers.includes(c.csvHeader)).map((c) => c.csvHeader)
  if (missing.length) problems.push(`CSV is missing columns: ${missing.join(', ')}`)
  const extra = headers.filter((h: string) => !COLUMNS.some((c) => c.csvHeader === h))
  if (extra.length) problems.push(`CSV has columns this script doesn't know: ${extra.join(', ')}`)

  const rows = parsed.data.map((raw: Record<string, string>, i: number): Row => {
    const data: Record<string, unknown> = {}
    for (const col of COLUMNS) {
      const text = raw[col.csvHeader] ?? ''
      if (col.type === 'date') {
        const iso = isoNoon(text)
        if (!iso) problems.push(`row ${i + 2}, ${col.label}: "${text}" is not M/D/YYYY`)
        data[col.key] = iso
        continue
      }
      const r = coerce(text, col)
      if (r.ok) data[col.key] = r.value
      else problems.push(`row ${i + 2}, ${col.label}: ${r.error}`)
    }
    const rawData = rawFromFlags(raw.flags ?? '')
    for (const k of Object.keys(rawData)) {
      if (data[k] !== null) problems.push(`row ${i + 2}: flags say ${k} was text, but the CSV has a value`)
    }
    return { data, rawData: Object.keys(rawData).length ? rawData : null }
  })
  return { rows, problems }
}

/** The checks from the plan. Returns the lines to print and the number of failures. */
function runChecks(rows: { data: Record<string, unknown>; rawData?: unknown }[]): { lines: string[]; failures: number } {
  const lines: string[] = []
  let failures = 0
  const check = (label: string, ok: boolean, detail: string) => {
    if (!ok) failures++
    lines.push(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${detail}`)
  }
  const counts = (key: string) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(String(r.data[key]), (m.get(String(r.data[key])) ?? 0) + 1)
    return m
  }
  const show = (m: Map<string, number>) => [...m].map(([k, v]) => `${k} ${v}`).join(', ')
  const same = (m: Map<string, number>, want: Record<string, number>) =>
    m.size === Object.keys(want).length && Object.entries(want).every(([k, v]) => m.get(k) === v)

  check('rows', rows.length === 129, `${rows.length} (want 129)`)
  const outcome = counts('outcome')
  check('outcomes', same(outcome, { not_stated: 103, extinguished_low_flow: 17, blowoff_high_flow: 7, no_ignition: 1, not_sustained: 1 }), show(outcome))
  const material = counts('material')
  check('materials', same(material, { PMMA: 98, 'SIBAL fabric': 27, 'Nomex fabric': 3, Wax: 1 }), show(material))
  const geometry = counts('geometry')
  check('geometry', geometry.get('rod') === 54, show(geometry))
  const unknown = rows.reduce((n, r) => n + Object.values(r.data).filter((v) => typeof v === 'string' && /^unknown$/i.test(v.trim())).length, 0)
  check('"unknown" values in any column', unknown === 0, String(unknown))
  const o2fBlank = rows.filter((r) => r.data.calibrated_final_o2 === null).map((r) => r.data.test_no)
  check('final O2 blanks', o2fBlank.length === 7, `${o2fBlank.length} (want 7, as in the clean table): ${o2fBlank.join(', ')}`)
  const o2 = rows.flatMap((r) => [r.data.calibrated_initial_o2, r.data.calibrated_final_o2]).filter((v): v is number => typeof v === 'number')
  const out = o2.filter((v) => v < 10 || v > 30)
  check('O2 readings within 10-30 %', out.length === 0, `${o2.length} readings, ${out.length} outside${out.length ? ': ' + out.join(', ') : ''}`)
  const flagged = rows.filter((r) => typeof r.data.flags === 'string' && r.data.flags !== '').length
  check('flagged rows', flagged === 47, `${flagged} (want 47)`)
  const dates = rows.map((r) => String(r.data.date))
  const noon = dates.filter((d) => /T12:00:00\.000Z$/.test(d)).length
  check('dates at 12:00 UTC', noon === rows.length, `${noon} of ${rows.length}`)
  const y2018 = rows.filter((r) => String(r.data.date).startsWith('2018')).map((r) => r.data.test_no)
  check('2018 dates kept as in the source (flagged)', y2018.join(',') === 'T9,T18', y2018.join(', '))
  const testIds = new Set(rows.map((r) => r.data.test_no))
  check('test ids unique', testIds.size === rows.length, `${testIds.size} distinct`)
  const withRaw = rows.filter((r) => r.rawData && Object.keys(r.rawData as object).length).length
  lines.push(`info  rows with source text kept in rawData: ${withRaw}`)
  return { lines, failures }
}

async function findPapers(payload: Awaited<ReturnType<typeof getPayload>>) {
  const res = await payload.find({ collection: 'papers', where: { ntrsId: { in: PAPERS_FOR_DATASET } }, depth: 0, pagination: false, draft: true })
  const byNtrs = new Map(res.docs.map((p) => [String(p.ntrsId), p.id]))
  return { datasetPapers: PAPERS_FOR_DATASET.map((n) => byNtrs.get(n)).filter((v) => v !== undefined), rowPaper: byNtrs.get(PAPER_FOR_ROWS) }
}

async function main() {
  const argv = process.argv.slice(2)
  const mode = argv.includes('--write') ? 'write' : argv.includes('--check') ? 'check' : 'dry-run'
  const csvAt = argv.indexOf('--csv')
  const csvPath = path.resolve(csvAt >= 0 ? argv[csvAt + 1] : DEFAULT_CSV)

  if (mode === 'check') {
    const payload = await getPayload({ config: await config })
    const found = await payload.find({ collection: 'datasets', where: { name: { equals: NAME } }, depth: 0, limit: 2 })
    if (found.docs.length !== 1) throw new Error(`Expected one dataset named "${NAME}", found ${found.docs.length}.`)
    const ds = found.docs[0]
    const stored = await payload.find({ collection: 'dataset-rows', where: { dataset: { equals: ds.id } }, depth: 0, pagination: false, sort: 'rowIndex' })
    console.log(`Dataset ${ds.id} "${ds.name}": published ${ds.published ? 'YES' : 'no'}, ${ds.columns?.length} columns, rowCount ${ds.rowCount}, rows stored ${stored.docs.length}`)
    const canon = (ds.columns ?? []).filter((c) => c.canonicalField).map((c) => `${c.key} -> ${c.canonicalField}`)
    console.log(`Standard fields: ${canon.join(', ')}`)
    const { lines, failures } = runChecks(stored.docs.map((d) => ({ data: d.data as Record<string, unknown>, rawData: d.rawData })))
    const extra: string[] = []
    let extraFail = 0
    const ck = (label: string, ok: boolean, detail: string) => { if (!ok) extraFail++; extra.push(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${detail}`) }
    ck('unpublished', ds.published !== true, `published = ${ds.published}`)
    ck('rowCount field matches the rows', ds.rowCount === stored.docs.length, `${ds.rowCount} vs ${stored.docs.length}`)
    const idx = stored.docs.map((d) => d.rowIndex)
    ck('rowIndex 1..129 in order', idx.every((v, i) => v === i + 1), `${idx[0]}..${idx[idx.length - 1]}`)
    const { rowPaper } = await findPapers(payload)
    const linked = stored.docs.filter((d) => (typeof d.sourcePaper === 'object' ? d.sourcePaper?.id : d.sourcePaper) === rowPaper).length
    ck('rows linked to the source paper', linked === stored.docs.length, `${linked} of ${stored.docs.length} -> paper ${rowPaper} (NTRS ${PAPER_FOR_ROWS})`)
    // Value for value against the CSV.
    const { rows: fromCsv } = buildRows(csvPath)
    let diff = 0
    const firstDiffs: string[] = []
    stored.docs.forEach((d, i) => {
      // Postgres jsonb keeps its own key order, so compare values, not JSON text.
      const dataSame = sameJson(d.data, fromCsv[i]?.data)
      const rawSame = sameJson(d.rawData ?? null, fromCsv[i]?.rawData ?? null)
      if (!dataSame || !rawSame) {
        diff++
        if (firstDiffs.length < 3) {
          firstDiffs.push(`row ${i + 1} ${dataSame ? 'rawData' : 'data'}: ${JSON.stringify(dataSame ? d.rawData : d.data).slice(0, 100)} vs ${JSON.stringify(dataSame ? fromCsv[i]?.rawData : fromCsv[i]?.data).slice(0, 100)}`)
        }
      }
    })
    ck('every stored row equals the CSV row', diff === 0, `${diff} differ${firstDiffs.length ? ': ' + firstDiffs.join(' | ') : ''}`)
    for (const l of [...lines, ...extra]) console.log(l)
    const total = failures + extraFail
    console.log(total === 0 ? `\nAll checks passed.` : `\n${total} check(s) failed.`)
    if (total) process.exitCode = 1
    return
  }

  const { rows, problems } = buildRows(csvPath)
  console.log(`${path.basename(csvPath)}: ${rows.length} rows, ${COLUMNS.length} columns -> dataset "${NAME}" (unpublished)`)
  console.log('Columns (key, type, unit, standard field):')
  for (const c of COLUMNS) {
    console.log(`  ${c.key.padEnd(24)} ${c.type.padEnd(8)} ${(c.unit ?? '').padEnd(5)} ${c.canonicalField ?? ''}${c.options ? `  [${c.options.map((o) => o.value).join(', ')}]` : ''}`)
  }
  console.log(problems.length ? `\n${problems.length} problem(s):\n  ${problems.slice(0, 20).join('\n  ')}` : '\nEvery value matches its column.')
  const { lines, failures } = runChecks(rows)
  for (const l of lines) console.log(l)
  if (problems.length || failures) throw new Error('Not clean: nothing was written.')
  if (mode === 'dry-run') return console.log('\nDry run: nothing was written.')

  const payload = await getPayload({ config: await config })
  const exists = await payload.find({ collection: 'datasets', where: { name: { equals: NAME } }, depth: 0, limit: 1 })
  if (exists.docs.length) throw new Error(`A dataset named "${NAME}" already exists (id ${exists.docs[0].id}). Nothing was written.`)
  const { datasetPapers, rowPaper } = await findPapers(payload)
  if (rowPaper === undefined) throw new Error(`Paper NTRS ${PAPER_FOR_ROWS} not found. Nothing was written.`)

  // One transaction: either the dataset and all its rows exist, or nothing does.
  const req = await createLocalReq({}, payload)
  const ownTransaction = await initTransaction(req)
  try {
    const ds = await payload.create({
      collection: 'datasets',
      data: { name: NAME, description: DESCRIPTION, published: false, papers: datasetPapers as number[], columns: COLUMNS as never },
      req,
    })
    for (let i = 0; i < rows.length; i++) {
      await payload.create({
        collection: 'dataset-rows',
        data: {
          dataset: ds.id,
          rowIndex: i + 1,
          data: rows[i].data,
          ...(rows[i].rawData ? { rawData: rows[i].rawData } : {}),
          sourcePaper: rowPaper as number,
        },
        req,
      })
      if ((i + 1) % 25 === 0 || i + 1 === rows.length) process.stdout.write(`\rInserted ${i + 1} / ${rows.length} rows`)
    }
    await payload.update({ collection: 'datasets', id: ds.id, data: { rowCount: rows.length, lastImportedAt: new Date().toISOString() }, req })
    if (ownTransaction) await commitTransaction(req)
    console.log(`\nCreated dataset ${ds.id} "${NAME}", unpublished, ${rows.length} rows. Run with --check to read it back.`)
  } catch (e) {
    if (ownTransaction) await killTransaction(req)
    throw new Error(`Import failed and was rolled back: ${(e as Error).message}`)
  }
}

/** Equal as JSON values, whatever the key order. */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort()
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

try {
  await main()
  process.exit(process.exitCode ?? 0)
} catch (e) {
  console.error(`\n${(e as Error).message}`)
  process.exit(1)
}
