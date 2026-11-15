/**
 * The cleaned FLEX and CFI-G PSI tables, as dataset definitions.
 *
 * Pure data + validation: no Payload, no database, no side effects, so the
 * definitions can be unit tested (tests/int/psi-tables.spec.ts) and reused by
 * the importer (src/scripts/import-psi-tables.ts). Column types, units and
 * category options are written out here rather than guessed. See
 * data/psi/README_flex_saffire_cfig.md for what each column means.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

import { coerce, type Column } from './dataset'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const DATA = path.resolve(HERE, '../../data/psi')

/** [csvHeader, key, label, type, unit, canonicalField, options, required] */
export type Def = [string, string, string, Column['type'], string | null, string | null, string[] | null, boolean]

export const FLEX_COLUMNS: Def[] = [
  ['test_no', 'test_no', 'Test No.', 'text', null, null, null, true],
  ['flex_id', 'flex_id', 'FLEX ID', 'text', null, null, null, false],
  ['date', 'date', 'Date', 'date', null, null, null, true],
  ['gmt', 'gmt', 'GMT', 'text', null, null, null, false],
  // The fuel is this table's "material": one droplet of methanol or heptane.
  ['fuel', 'fuel', 'Fuel', 'category', null, 'material', ['methanol', 'heptane'], true],
  ['pressure_mmhg', 'pressure_mmhg', 'Pressure', 'number', 'mmHg', null, null, false],
  ['pressure_atm', 'pressure_atm', 'Pressure', 'number', 'atm', null, null, false],
  // Mole fractions, not percent: the canonical O2 field means percent, so these
  // stay unmapped rather than being read as 0.21%.
  ['x_o2', 'x_o2', 'O₂ mole fraction', 'number', 'mol/mol', null, null, true],
  ['x_n2', 'x_n2', 'N₂ mole fraction', 'number', 'mol/mol', null, null, true],
  ['x_co2', 'x_co2', 'CO₂ mole fraction', 'number', 'mol/mol', null, null, true],
  ['x_he', 'x_he', 'He mole fraction', 'number', 'mol/mol', null, null, true],
  ['diluent_added', 'diluent_added', 'Diluent added', 'category', null, null, ['CO2', 'none', 'He'], true],
  ['d0_mm', 'd0_mm', 'Starting droplet diameter', 'number', 'mm', null, null, false],
  ['d_ext_mm', 'd_ext_mm', 'Droplet diameter at extinction', 'number', 'mm', null, null, false],
  // The source header says "mm"; it is mm²/s (see the README's d-squared check).
  ['burning_rate_k_mm2_s', 'burning_rate_k_mm2_s', 'Burning-rate constant K', 'number', 'mm²/s', null, null, false],
  ['burn_time_s', 'burn_time_s', 'Burn time', 'number', 's', null, null, false],
  ['outcome', 'outcome', 'Outcome', 'category', null, 'outcome', ['extinction', 'disruption', 'completion'], true],
  ['d2_law_time_s', 'd2_law_time_s', 'd²-law burn time (our check)', 'number', 's', null, null, false],
  ['flags', 'flags', 'Flags', 'text', null, null, null, false],
]

export const CFIG_COLUMNS: Def[] = [
  [
    'flame_type', 'flame_type', 'Flame type', 'category', null, null,
    ['normal (fuel out of burner)', 'inverse (oxygen out of burner)'], true,
  ],
  ['day', 'day', 'Day', 'integer', null, null, null, true],
  ['test_id', 'test_id', 'Test ID', 'text', null, null, null, true],
  ['fuel', 'fuel', 'Fuel', 'category', null, 'material', ['ethane', 'propane', 'butane', '30% butane', '30% propane', '50% butane', '30% ethane'], true],
  ['x_o2', 'x_o2', 'O₂ mole fraction', 'number', 'mol/mol', null, null, true],
  ['x_o2_after', 'x_o2_after', 'O₂ mole fraction after', 'number', 'mol/mol', null, null, false],
  ['fuel_fraction', 'fuel_fraction', 'Fuel fraction', 'number', null, null, null, true],
  ['pressure_bar', 'pressure_bar', 'Pressure', 'number', 'bar', null, null, true],
  ['fuel_flow_mg_s', 'fuel_flow_mg_s', 'Fuel flow', 'number', 'mg/s', null, null, true],
  ['o2_flow_mg_s', 'o2_flow_mg_s', 'O₂ flow', 'number', 'mg/s', null, null, false],
  ['adiabatic_flame_temp_k', 'adiabatic_flame_temp_k', 'Adiabatic flame temperature', 'number', 'K', null, null, false],
  ['z_st', 'z_st', 'Stoichiometric mixture fraction Z_st', 'number', null, null, null, false],
  ['hot_ignition', 'hot_ignition', 'Hot ignition', 'category', null, null, ['yes', 'no', 'flash'], true],
  ['cool_flame', 'cool_flame', 'Cool flame observed', 'category', null, null, ['yes', 'no'], false],
  ['burn_time_s', 'burn_time_s', 'Burn time', 'number', 's', null, null, false],
  ['outcome', 'outcome', 'Outcome', 'category', null, 'outcome', ['self_extinguished', 'flow_terminated', 'no_ignition', 'flash_only'], true],
  ['peak_burner_temp_c', 'peak_burner_temp_c', 'Peak burner temperature', 'number', '°C', null, null, false],
  ['color', 'color', 'Flame colour', 'text', null, null, null, false],
  ['comments', 'comments', 'Comments', 'text', null, null, null, false],
  ['flags', 'flags', 'Flags', 'text', null, null, null, false],
]

export interface Table {
  name: string
  description: string
  csv: string
  /** NTRS ids from data/psi/sources.json; linked only where the Papers collection already has them. */
  papers: string[]
  defs: Def[]
  checks: (rows: { data: Record<string, unknown> }[]) => { lines: string[]; failures: number }
}

export const count = (rows: { data: Record<string, unknown> }[], key: string) => {
  const m = new Map<string, number>()
  for (const r of rows) m.set(String(r.data[key]), (m.get(String(r.data[key])) ?? 0) + 1)
  return m
}

const show = (m: Map<string, number>) => [...m].map(([k, v]) => `${k} ${v}`).join(', ')
const same = (m: Map<string, number>, want: Record<string, number>) =>
  m.size === Object.keys(want).length && Object.entries(want).every(([k, v]) => m.get(k) === v)

/** Every column marked required must have a value in every row. */
export function requiredCheck(rows: { data: Record<string, unknown> }[], defs: Def[]) {
  const blanks: string[] = []
  for (const [, key, label, , , , , required] of defs) {
    if (!required) continue
    const n = rows.filter((r) => r.data[key] === null || r.data[key] === undefined).length
    if (n) blanks.push(`${label} ${n}`)
  }
  return blanks
}

export const TABLES: Table[] = [
  {
    name: 'FLEX (cleaned)',
    description:
      'NASA FLEX (PSI-69): 274 single-droplet combustion tests (methanol, heptane) in still air, ' +
      'many with CO2 or helium added to study suppression. Nothing was invented: every value comes ' +
      'from the source row, and the flags column lists every problem found. Outcome words are FLEX\'s: ' +
      'extinction = flame went out with liquid left; completion = the droplet burned away; ' +
      'disruption = the test was disturbed, so it is not a clean result. Source: PSI-69 table.',
    csv: 'flex_tests_clean.csv',
    papers: ['20140006750', '20120015928', '20150023456', '20130014061'],
    defs: FLEX_COLUMNS,
    checks: (rows) => {
      const lines: string[] = []
      let failures = 0
      const check = (label: string, ok: boolean, detail: string) => {
        if (!ok) failures++
        lines.push(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${detail}`)
      }
      check('rows', rows.length === 274, `${rows.length} (want 274)`)
      check('fuels', same(count(rows, 'fuel'), { methanol: 157, heptane: 117 }), show(count(rows, 'fuel')))
      check('outcomes', same(count(rows, 'outcome'), { extinction: 186, disruption: 61, completion: 27 }), show(count(rows, 'outcome')))
      check('diluents', same(count(rows, 'diluent_added'), { CO2: 123, none: 101, He: 50 }), show(count(rows, 'diluent_added')))
      const o2 = rows.map((r) => r.data.x_o2).filter((v): v is number => typeof v === 'number')
      const o2bad = o2.filter((v) => v <= 0 || v >= 1)
      check('O₂ mole fractions within 0-1', o2bad.length === 0, `${o2.length} values, ${o2bad.length} outside`)
      const ids = new Set(rows.map((r) => r.data.test_no))
      check('test numbers unique', ids.size === rows.length, `${ids.size} distinct`)
      const blanks = requiredCheck(rows, FLEX_COLUMNS)
      check('required columns complete', blanks.length === 0, blanks.join(', ') || 'none blank')
      return { lines, failures }
    },
  },
  {
    name: 'CFI-G (cleaned)',
    description:
      'NASA CFI-G (ACME, PSI-159): 333 gas-flame tests (ethane, propane, butane and mixes) from a ' +
      'spherical porous burner. 179 normal flames send fuel into an oxygen-rich chamber; 154 inverse ' +
      'flames send oxygen into a fuel-filled one. Nothing was invented: every value comes from the ' +
      'source row, and the flags column lists every problem found. 115 normal-flame tests ran at 30% ' +
      'O2 or more — the range expected in Moon bases and rovers. Source: PSI-159 table.',
    csv: 'cfig_tests_clean.csv',
    papers: [],
    defs: CFIG_COLUMNS,
    checks: (rows) => {
      const lines: string[] = []
      let failures = 0
      const check = (label: string, ok: boolean, detail: string) => {
        if (!ok) failures++
        lines.push(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${detail}`)
      }
      check('rows', rows.length === 333, `${rows.length} (want 333)`)
      check('flame types', same(count(rows, 'flame_type'), {
        'normal (fuel out of burner)': 179,
        'inverse (oxygen out of burner)': 154,
      }), show(count(rows, 'flame_type')))
      check('outcomes', same(count(rows, 'outcome'), {
        self_extinguished: 175, flow_terminated: 88, no_ignition: 62, flash_only: 8,
      }), show(count(rows, 'outcome')))
      check('fuels', count(rows, 'fuel').size === 7, show(count(rows, 'fuel')))
      const o2 = rows.map((r) => r.data.x_o2).filter((v): v is number => typeof v === 'number')
      const o2bad = o2.filter((v) => v <= 0 || v >= 1)
      check('O₂ mole fractions within 0-1', o2bad.length === 0, `${o2.length} values, ${o2bad.length} outside`)
      const ids = new Set(rows.map((r) => r.data.test_id))
      check('test ids unique', ids.size === rows.length, `${ids.size} distinct`)
      const blanks = requiredCheck(rows, CFIG_COLUMNS)
      check('required columns complete', blanks.length === 0, blanks.join(', ') || 'none blank')
      return { lines, failures }
    },
  },
]

/* ------------------------------------------------------------------ */
/* Build and validate                                                  */
/* ------------------------------------------------------------------ */

export type Row = { data: Record<string, unknown> }

export function toColumn([csvHeader, key, label, type, unit, canonicalField, options, required]: Def): Column & { csvHeader: string } {
  return {
    csvHeader, label, key, type, required,
    ...(unit ? { unit } : {}),
    ...(canonicalField ? { canonicalField } : {}),
    ...(options ? { options: options.map((value) => ({ value })) } : {}),
  }
}

/**
 * Read one cleaned table and coerce every value against its column definition.
 * Any mismatch is reported, never silently dropped: the importer refuses to
 * write when this returns problems.
 */
export function buildRows(csvPath: string, defs: Def[]): { rows: Row[]; problems: string[] } {
  const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
  })
  const problems: string[] = []
  const headers = parsed.meta.fields ?? []
  const missing = defs.filter((d) => !headers.includes(d[0])).map((d) => d[0])
  if (missing.length) problems.push(`CSV is missing columns: ${missing.join(', ')}`)
  const extra = headers.filter((h: string) => !defs.some((d) => d[0] === h))
  if (extra.length) problems.push(`CSV has columns this script doesn't know: ${extra.join(', ')}`)

  const rows = parsed.data.map((raw: Record<string, string>, i: number): Row => {
    const data: Record<string, unknown> = {}
    for (const def of defs) {
      const r = coerce(raw[def[0]] ?? '', toColumn(def))
      if (r.ok) data[def[1]] = r.value
      else problems.push(`row ${i + 2}, ${def[2]}: ${r.error}`)
    }
    return { data }
  })
  return { rows, problems }
}
