/**
 * Writes the PSI catalogue: one card per NASA PSI combustion investigation,
 * built only from the cleaned tables in data/psi/ (copied unchanged from
 * nasa-project/data). No database, no network.
 *
 *   node --import tsx/esm src/scripts/psi-catalogue.ts           # write psi.json
 *   node --import tsx/esm src/scripts/psi-catalogue.ts --check   # rebuild, compare, write nothing
 *
 * Output: src/app/(frontend)/dashboard/components/investigations/psi.json.
 * Hand-checked paper titles come from data/psi/sources.json (every card
 * cites its PSI id anyway). See data/psi/README-catalogue.md.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

import type { PsiCatalogue, PsiFact, PsiInvestigation, PsiSource } from '../lib/psi'

const ROOT = process.cwd()
const DATA = path.join(ROOT, 'data', 'psi')
export const OUT = path.join(ROOT, 'src', 'app', '(frontend)', 'dashboard', 'components', 'investigations', 'psi.json')
const SCORECARD = path.join(ROOT, 'src', 'app', '(frontend)', 'dashboard', 'components', 'sandbox', 'scorecard.json')

type Row = Record<string, string>

function readCsv(file: string): Row[] {
  const text = fs.readFileSync(path.join(DATA, file), 'utf8').replace(/^﻿/, '')
  return Papa.parse(text, { header: true, skipEmptyLines: 'greedy' }).data as Row[]
}

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === '') return null
  const v = Number(s)
  return Number.isFinite(v) ? v : null
}

// ---- Facts: small, declared per investigation, computed from its table --------

type FactSpec =
  | { kind: 'count'; column: string; label: string; where?: (r: Row) => boolean }
  | { kind: 'range'; column: string; label: string; unit: string; where?: (r: Row) => boolean }
  | { kind: 'sum'; column: string; label: string }

function fact(rows: Row[], spec: FactSpec): PsiFact {
  const use = spec.kind !== 'sum' && spec.where ? rows.filter(spec.where) : rows
  if (spec.kind === 'count') {
    const counts = new Map<string, number>()
    for (const r of use) {
      const v = (r[spec.column] ?? '').trim()
      if (v !== '') counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    const items = [...counts].map(([value, count]) => ({ value: value.replace(/_/g, ' '), count }))
    items.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    return { kind: 'count', label: spec.label, total: items.reduce((s, i) => s + i.count, 0), items }
  }
  const vals = use.map((r) => num(r[spec.column])).filter((v): v is number => v !== null)
  if (vals.length === 0) throw new Error(`no numbers in column ${spec.column} for "${spec.label}"`)
  if (spec.kind === 'sum') return { kind: 'sum', label: spec.label, value: vals.reduce((s, v) => s + v, 0), n: vals.length }
  return { kind: 'range', label: spec.label, unit: spec.unit, min: Math.min(...vals), max: Math.max(...vals), n: vals.length }
}

const atLeast30 = (column: string) => (r: Row) => (num(r[column]) ?? 0) >= 0.3
const normal = (r: Row) => r.flame_type?.startsWith('normal') ?? false

const FACTS: Record<string, FactSpec[]> = {
  'BASS-II': [{ kind: 'count', column: 'outcome', label: "NASA's stated outcome" }],
  BASS: [{ kind: 'count', column: 'material', label: 'Samples by material' }],
  'Saffire I-III': [
    { kind: 'count', column: 'mission', label: 'Samples by mission' },
    { kind: 'count', column: 'material', label: 'Samples by material' },
    { kind: 'range', column: 'burn_time_s', label: 'Burn time', unit: 's' },
    // Text in the source ("2.1 mm/s", "n/a", "Note 4"), so listed as written, not as a range.
    { kind: 'count', column: 'ug_spread_rate_mm_s', label: 'Flame spread in microgravity, as written in the table' },
  ],
  FLEX: [
    { kind: 'count', column: 'outcome', label: 'Outcome' },
    { kind: 'count', column: 'diluent_added', label: 'Diluent added to the chamber' },
    { kind: 'range', column: 'burn_time_s', label: 'Burn time', unit: 's' },
  ],
  'FLEX-2': [{ kind: 'count', column: 'fuel', label: 'Fuels (ranges only, no single tests)' }],
  CFI: [{ kind: 'count', column: 'fuel', label: 'Tests by fuel' }],
  'CFI-G (ACME)': [
    { kind: 'count', column: 'flame_type', label: 'Flame type' },
    { kind: 'count', column: 'outcome', label: 'Outcome, all tests' },
    { kind: 'count', column: 'outcome', label: 'Outcome, normal flames at 30% O2 or more', where: (r) => normal(r) && atLeast30('x_o2')(r) },
  ],
  'Flame Design (ACME)': [
    { kind: 'count', column: 'flame_type', label: 'Flame type' },
    { kind: 'count', column: 'fuel', label: 'Tests by fuel' },
  ],
  'BRE (ACME)': [
    { kind: 'count', column: 'fuel', label: 'Test days by fuel' },
    { kind: 'sum', column: 'flames_ignited', label: 'Flames ignited, all days' },
  ],
  'CLD Flame (ACME)': [
    { kind: 'count', column: 'fuel_bottle', label: 'Test days by fuel bottle' },
    { kind: 'sum', column: 'flames_ignited', label: 'Flames ignited, all days' },
  ],
  's-Flame (ACME)': [
    { kind: 'count', column: 'atmosphere', label: 'Test days by atmosphere' },
    { kind: 'sum', column: 'flames_ignited', label: 'Flames ignited, all days' },
  ],
  SPICE: [
    { kind: 'count', column: 'fuel', label: 'Flame conditions by fuel' },
    // A few readings are slightly negative (flagged in the table as a sensor offset): left out of the range.
    { kind: 'range', column: 'air_coflow_cm_s', label: 'Air coflow (negative readings, flagged as sensor offset, left out)', unit: 'cm/s', where: (r) => (num(r.air_coflow_cm_s) ?? -1) >= 0 },
  ],
  'SAME-R': [
    { kind: 'count', column: 'material', label: 'Runs by material' },
    { kind: 'count', column: 'record_type', label: 'Record type' },
  ],
  SAME: [{ kind: 'count', column: 'material', label: 'Samples by material' }],
}

// Granularities where each row is one test, so the catalogue's count must equal the rows.
const PER_TEST = /^per (test|sample|run|flame condition)$/

const slug = (name: string) => name.toLowerCase().replace(/\(acme\)/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The catalogue, built from data/psi/ (the unit test compares it with psi.json). */
export function build(): PsiCatalogue {
  const catalogueText = fs.readFileSync(path.join(DATA, 'investigations_catalogue.csv'))
  const catalogue = readCsv('investigations_catalogue.csv')
  const papers = (JSON.parse(fs.readFileSync(path.join(DATA, 'sources.json'), 'utf8')) as {
    papers: Record<string, { title: string; ntrsId: string; url: string }[]>
  }).papers
  for (const name of Object.keys(papers)) {
    if (!catalogue.some((c) => c.investigation === name)) throw new Error(`sources.json names "${name}", which is not in the catalogue`)
  }
  const scorecard = JSON.parse(fs.readFileSync(SCORECARD, 'utf8')) as { matched: number; scored: number; matchedTests: string[] }

  const investigations: PsiInvestigation[] = catalogue.map((c) => {
    const rows = readCsv(c.cleaned_file)
    const tests = Number(c.tests)
    if (PER_TEST.test(c.granularity) && tests !== rows.length) {
      throw new Error(`${c.investigation}: the catalogue says ${tests} tests, ${c.cleaned_file} has ${rows.length} rows`)
    }
    const specs = FACTS[c.investigation]
    if (!specs) throw new Error(`no facts declared for ${c.investigation}`)
    const facts = specs.map((s) => fact(rows, s))
    if (c.investigation === 'BASS-II') {
      facts.push({
        kind: 'note',
        label: 'Our simulator (not NASA data)',
        text: `The Flame in Freefall sandbox matches ${scorecard.matched} of ${scorecard.scored} tests with a stated outcome (${scorecard.matchedTests.join(', ')}).`,
      })
    }
    const sources: PsiSource[] = [
      { kind: 'psi', psiId: c.psi_id, table: c.cleaned_file },
      ...(papers[c.investigation] ?? []).map((p) => ({ kind: 'paper' as const, ...p })),
    ]
    return {
      id: slug(c.investigation),
      name: c.investigation,
      psiId: c.psi_id,
      fuelPhase: c.fuel_phase,
      hardware: c.hardware,
      tests,
      granularity: c.granularity,
      rows: rows.length,
      flaggedRows: rows.filter((r) => (r.flags ?? '').trim() !== '').length,
      fuels: c.fuels,
      o2Pct: c.o2_pct,
      pressure: c.pressure,
      flowCmS: c.flow_cm_s,
      outcomeRecorded: c.outcome_recorded,
      safetyTheme: c.safety_theme,
      simulator: c.simulator,
      cleanedFile: c.cleaned_file,
      facts,
      sources,
    }
  })
  const ids = new Set(investigations.map((i) => i.id))
  if (ids.size !== investigations.length) throw new Error('two investigations have the same id')

  return {
    about:
      'Built by src/scripts/psi-catalogue.ts from the cleaned NASA PSI tables in data/psi/ (copied unchanged from nasa-project/data). Every number is computed from those tables. Do not edit by hand: change the script or data/psi/sources.json.',
    catalogueSha256: crypto.createHash('sha256').update(catalogueText).digest('hex'),
    investigations,
  }
}

function main() {
  const text = JSON.stringify(build(), null, 2) + '\n'
  if (process.argv.includes('--check')) {
    const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : ''
    if (old !== text) {
      console.log(`DIFFERENT from ${path.relative(ROOT, OUT)}: rerun without --check to rewrite it.`)
      process.exitCode = 1
    } else console.log(`Same as ${path.relative(ROOT, OUT)}.`)
    return
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, text)
  console.log(`Wrote ${path.relative(ROOT, OUT)}.`)
}

// Run only when started as a script, not when a test imports build().
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (e) {
    console.error((e as Error).message)
    process.exitCode = 1
  }
}
