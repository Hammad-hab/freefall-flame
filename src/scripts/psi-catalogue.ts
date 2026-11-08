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

import {
  HABITAT_REFERENCE,
  SIM_STATUS,
  type SimStatus,
  type PsiSimulation,
  type CriterionScore,
  type MoonBase,
  type PsiCatalogue,
  type PsiFact,
  type PsiInvestigation,
  type PsiScores,
  type PsiSource,
} from '../lib/psi'

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

// ---- Habitat-relevance criteria (rules in CRITERIA, src/lib/psi.ts) ------------

/** "13.6-22.2" -> [13.6, 22.2]; "21 (air)" -> [21, 21]; "~1 atm" -> [1, 1]; no number -> null. */
function parseRange(text: string): [number, number] | null {
  const m = /(-?\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/.exec(text)
  if (!m) return null
  const a = Number(m[1])
  return [a, m[2] !== undefined ? Number(m[2]) : a]
}

/** The catalogue's pressure text in atm ("0.495-3.31 bar" is converted), or null if not given. */
function pressureAtm(text: string): [number, number] | null {
  if (/not in table|not given/.test(text)) return null
  const r = parseRange(text)
  if (!r) return null
  const BAR_TO_ATM = 1 / 1.01325
  return /bar/.test(text) ? [r[0] * BAR_TO_ATM, r[1] * BAR_TO_ATM] : r
}

const overlaps = (r: [number, number], band: number[]) => r[0] <= band[1] && r[1] >= band[0]
const fmtRange = (r: [number, number], unit: string) =>
  r[0] === r[1] ? `${Number(r[0].toFixed(3))} ${unit}` : `${Number(r[0].toFixed(3))}-${Number(r[1].toFixed(3))} ${unit}`

const HABITAT_SOLIDS = ['PMMA', 'SIBAL', 'Nomex', 'silicone', 'Kapton', 'Teflon', 'Ultem', 'Pyrell', 'lampwick']

function scoreMaterials(c: Row): CriterionScore {
  const found = HABITAT_SOLIDS.filter((m) => new RegExp(`\\b${m}\\b`, 'i').test(c.fuels))
  if (found.length) return { score: 2, reason: `spacecraft solids in the table: ${found.join(', ')}` }
  if (/emulating solids/.test(c.fuel_phase)) return { score: 1, reason: `${c.fuel_phase}: gas flames used to stand in for burning solids` }
  return { score: 0, reason: `model fuels only: ${c.fuels}` }
}

function scoreAtmosphere(c: Row): CriterionScore {
  const ref = HABITAT_REFERENCE
  const o2 = c.o2_pct === 'not in table' ? null : parseRange(c.o2_pct)
  const p = pressureAtm(c.pressure)
  const iss = !!o2 && !!p && overlaps(o2, ref.iss.o2Pct) && overlaps(p, ref.iss.pressureAtm)
  const expl = (!!o2 && o2[1] >= ref.exploration.minO2Pct) || (!!p && p[0] <= ref.exploration.maxPressureAtm)
  const given = `O2 ${o2 ? fmtRange(o2, '%') : 'not in the table'}, pressure ${p ? fmtRange(p, 'atm') : c.pressure === 'not in table' ? 'not in the table' : 'not given'}`
  const parts = [iss ? 'covers ISS air' : 'does not cover ISS air', expl ? 'reaches the exploration atmosphere' : 'does not reach the exploration atmosphere']
  return { score: ((iss ? 1 : 0) + (expl ? 1 : 0)) as 0 | 1 | 2, reason: `${given}: ${parts.join('; ')}` }
}

function scoreAirflow(c: Row): CriterionScore {
  const band = HABITAT_REFERENCE.ventilation.cmS
  const f = c.flow_cm_s
  if (/quiescent|still/.test(f)) return { score: 1, reason: `${f}: still air only, the ventilation-failure case` }
  if (/burner|coflow/.test(f) && !/\d+\s*-/.test(f)) return { score: 0, reason: `${f}: no air speed comparable with cabin ventilation` }
  const r = f === 'not in table' ? null : parseRange(f)
  if (!r) return { score: 0, reason: 'flow not in the table' }
  if (overlaps(r, band)) return { score: 2, reason: `${fmtRange(r, 'cm/s')} overlaps cabin ventilation (${band[0]}-${band[1]} cm/s)` }
  if (r[1] < band[0]) return { score: 1, reason: `${fmtRange(r, 'cm/s')}: below the ${band[0]} cm/s ventilation minimum, the ventilation-failure case` }
  return { score: 0, reason: `${fmtRange(r, 'cm/s')}: faster than cabin ventilation` }
}

function scoreRichness(c: Row): CriterionScore {
  const many = Number(c.tests) >= 100
  const outcomes = /^(yes|partial)/.test(c.outcome_recorded)
  return {
    score: ((many ? 1 : 0) + (outcomes ? 1 : 0)) as 0 | 1 | 2,
    reason: `${c.tests} tests in the table (${c.granularity})${many ? '' : ', fewer than 100'}; outcomes: ${c.outcome_recorded}`,
  }
}

// Criterion e is our judgement, written down here with its reason.
const DECISION: Record<string, CriterionScore> = {
  'BASS-II': { score: 2, reason: 'prevention: which solids keep burning at which oxygen and air speed, in a spacecraft-like flow duct' },
  BASS: { score: 1, reason: 'the same question for more materials, but the table holds only dates and samples; results are in the reports' },
  'Saffire I-III': { score: 2, reason: 'prevention: how a large fire grows inside a real spacecraft' },
  FLEX: { score: 2, reason: 'suppression: whether CO2 or helium dilution puts a flame out' },
  'FLEX-2': { score: 0, reason: 'fundamental droplet combustion; only ranges in the table' },
  CFI: { score: 0, reason: 'cool-flame chemistry, far from a cabin fire decision' },
  'CFI-G (ACME)': { score: 2, reason: 'flammability at exploration oxygen levels (30% and more)' },
  'Flame Design (ACME)': { score: 0, reason: 'soot control through flame structure; fundamental' },
  'BRE (ACME)': { score: 1, reason: 'material flammability in still air, but through gas flames standing in for solids' },
  'CLD Flame (ACME)': { score: 0, reason: 'fundamental laminar flames' },
  's-Flame (ACME)': { score: 0, reason: 'fundamental spherical flames (nitrogen against helium)' },
  SPICE: { score: 1, reason: 'smoke formation, which bears on smoke detection, but no smoke point in the table' },
  'SAME-R': { score: 2, reason: 'detection: the smoke particles that cabin smoke detectors must see' },
  SAME: { score: 2, reason: 'detection: smoke from heated spacecraft materials' },
}

// ---- What we simulated, and why (replaces the catalogue's old "simulator" column) ----
// Each reason was checked against the cleaned tables and their READMEs
// (data/psi/README_*.md) and against flame-core's README (gas flames: "built
// but not testable in this 2D model"; Saffire: six PARTIAL presets, the four
// silicone samples NOT MODELLED). Saffire's hand comparison (0 of 6) is the
// engine project's, the same words as the sandbox's Saffire note.

const GAS_LIMIT =
  'the gas flames we built (see CFI-G) do not hold in our 2 mm cells, so this is not testable either'
const DROPLETS =
  'Droplet flames: the engine has no droplet model. That stage was dropped once gas flames proved not testable at our 2 mm cells (see CFI-G)'
const SMOKE =
  "the engine's smoke is a single material (cooled flame gas) with no particles or soot"

function simulation(c: Row, bass2Rows: number, scorecard: { matched: number; scored: number; matchedTests: string[] }): PsiSimulation {
  const s = (status: SimStatus, reason: string): PsiSimulation => ({ status, label: SIM_STATUS[status], reason })
  switch (c.investigation) {
    case 'BASS-II':
      return s('scored', `NASA's table gives each test's oxygen and its airflow readings over time, so each test can be set up as a preset: ${bass2Rows} presets. NASA states an outcome for ${scorecard.scored} of them, so those can be scored: ${scorecard.matched} match (${scorecard.matchedTests.join(', ')}).`)
    case 'Saffire I-III':
      return s('by-hand', "The tables give burn times (Saffire-I and -II) and spread rates (Saffire-II), not outcome codes, so the 6 runnable presets were compared with NASA's results by hand: 0 of 6 reproduce them. The 4 silicone samples (Saffire-II) are skipped because the engine has no silicone; Saffire-III's table has no results.")
    case 'CFI-G (ACME)':
      return s('not-testable', "Gas flames were built (fuel gas, a burner, a one-step reaction) and the 43 CFI-G presets run, but none of them keeps a flame going. A radiation audit ruled radiation out as the cause; the likely cause is our 2 mm cell, coarser than a real weak flame. Only the visual demo (radiation off, not NASA-scored) shows a flame.")
    case 'BASS':
      return s('none', 'The table records only the date and the sample (material, shape and size, read from the sample name): no oxygen, airflow or outcome, so there is nothing to set up or check against.')
    case 'FLEX':
      return s('none', `${DROPLETS}.`)
    case 'FLEX-2':
      return s('none', `${DROPLETS}. Its table also holds ranges per fuel only, no single tests.`)
    case 'CFI':
      return s('none', `${DROPLETS}. Its table (dodecane droplets, cool flames) records no outcomes.`)
    case 'Flame Design (ACME)':
      return s('none', `Gas flames: ${GAS_LIMIT}. The table holds the conditions only.`)
    case 'BRE (ACME)':
      return s('none', `Gas flames standing in for solids: ${GAS_LIMIT}. The table has day summaries only (flames ignited per day).`)
    case 'CLD Flame (ACME)':
      return s('none', `Gas flames: ${GAS_LIMIT}. The table has day summaries only.`)
    case 's-Flame (ACME)':
      return s('none', `Spherical gas flames: ${GAS_LIMIT}. The table has day summaries only.`)
    case 'SPICE':
      return s('none', `Smoke from gas jet flames: ${SMOKE}, and the table holds the flame conditions, not the smoke points.`)
    case 'SAME-R':
      return s('none', `Smoke from heated materials, not flames, for smoke detectors: ${SMOKE}, and the table holds the heating conditions, not the smoke measurements.`)
    case 'SAME':
      return s('none', `Smoke from heated materials, not flames, for smoke detectors: ${SMOKE}.`)
  }
  throw new Error(`no simulation status written for ${c.investigation}`)
}

function scores(c: Row): PsiScores {
  const decision = DECISION[c.investigation]
  if (!decision) throw new Error(`no judgement written for ${c.investigation}`)
  return { materials: scoreMaterials(c), atmosphere: scoreAtmosphere(c), airflow: scoreAirflow(c), richness: scoreRichness(c), decision }
}

// ---- Moon-base scenario: what the tables hold near 34% O2 (an extrapolation card) ----

const ATM_PER_BAR = 1 / 1.01325
const listMax = (s: string | undefined) => Math.max(...(s ?? '').split(';').map((x) => Number(x.trim())).filter(Number.isFinite))
const near34 = (frac: number | null) => frac !== null && Math.abs(frac - 0.34) <= 0.005

function moonBase(): MoonBase {
  const bass2 = readCsv('bass2_tests_clean.csv')
  const saffire = readCsv('saffire_tests_clean.csv')
  const solidMax = (rows: Row[], col: string) => Math.max(...rows.map((r) => num(r[col])).filter((v): v is number => v !== null))
  const outcomes = (rows: Row[]) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.outcome.replace(/_/g, ' '), (m.get(r.outcome.replace(/_/g, ' ')) ?? 0) + 1)
    return [...m].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
  }

  const flex = readCsv('flex_tests_clean.csv').filter((r) => (num(r.x_o2) ?? 0) >= 0.3)
  const cfig = readCsv('cfig_tests_clean.csv').filter((r) => r.flame_type.startsWith('normal') && (num(r.x_o2) ?? 0) >= 0.3)
  const design = readCsv('flame_design_tests_clean.csv').filter((r) => r.flame_type === 'normal' && (num(r.x_o2) ?? 0) >= 0.3)
  const bre = readCsv('acme_bre_days_clean.csv').filter((r) => listMax(r.o2_pct_values) >= 30)
  const sflame = readCsv('acme_sflame_days_clean.csv').filter((r) => /~30%/.test(r.atmosphere))
  const flex2 = readCsv('flex2_summary_clean.csv').filter((r) => listMax(r.x_o2_values) >= 0.3)

  return {
    o2Pct: 34,
    gravityG: 0.17,
    solidMaxO2Pct: solidMax(bass2, 'o2_initial_pct'),
    saffireMaxO2Pct: solidMax(saffire, 'o2_pct'),
    near: [
      { investigation: 'CFI-G (ACME)', what: 'normal gas flames', unit: 'tests', atLeast30: cfig.length, at34: cfig.filter((r) => near34(num(r.x_o2))).length, lowPressure: cfig.filter((r) => (num(r.pressure_bar) ?? 9) * ATM_PER_BAR <= 0.7).length, outcomes: outcomes(cfig) },
      { investigation: 'FLEX', what: 'fuel droplets', unit: 'tests', atLeast30: flex.length, at34: flex.filter((r) => near34(num(r.x_o2))).length, lowPressure: flex.filter((r) => (num(r.pressure_atm) ?? 9) <= 0.7).length, outcomes: outcomes(flex) },
      { investigation: 'Flame Design (ACME)', what: 'normal gas flames', unit: 'tests', atLeast30: design.length, at34: design.filter((r) => near34(num(r.x_o2))).length, lowPressure: design.filter((r) => (num(r.pressure_atm) ?? 9) <= 0.7).length, outcomes: null },
      { investigation: 'BRE (ACME)', what: 'gas flames standing in for solids, still air', unit: 'test days', atLeast30: bre.length, at34: bre.filter((r) => r.o2_pct_values.split(';').map((x) => x.trim()).includes('34')).length, lowPressure: null, outcomes: null },
      { investigation: 's-Flame (ACME)', what: 'spherical gas flames', unit: 'test days', atLeast30: sflame.length, at34: 0, lowPressure: null, outcomes: null },
      { investigation: 'FLEX-2', what: 'fuel droplets (ranges only)', unit: 'fuels', atLeast30: flex2.length, at34: 0, lowPressure: null, outcomes: null },
    ],
  }
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
  const bass2Rows = readCsv('bass2_tests_clean.csv').length

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
      simulation: simulation(c, bass2Rows, scorecard),
      cleanedFile: c.cleaned_file,
      facts,
      sources,
      scores: scores(c),
    }
  })
  const ids = new Set(investigations.map((i) => i.id))
  if (ids.size !== investigations.length) throw new Error('two investigations have the same id')

  return {
    about:
      'Built by src/scripts/psi-catalogue.ts from the cleaned NASA PSI tables in data/psi/ (copied unchanged from nasa-project/data). Every number is computed from those tables. Do not edit by hand: change the script or data/psi/sources.json.',
    // Over the text with line endings made LF, so a CRLF checkout gives the same value.
    catalogueSha256: crypto.createHash('sha256').update(catalogueText.toString('utf8').replace(/\r\n/g, '\n')).digest('hex'),
    reference: HABITAT_REFERENCE,
    investigations,
    moonBase: moonBase(),
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
