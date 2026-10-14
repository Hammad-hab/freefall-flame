/**
 * Unit tests for the pure dashboard logic in src/lib/combustion.ts.
 * Covers column resolution, censored-value classification, metric
 * calculation, O2 band derivation, and evidence-score normalization.
 */
import { describe, it, expect } from 'vitest'
import {
  classifyReading,
  resolveColumn,
  resolveColumnSet,
  type ColumnSpec,
  type ColumnResolution,
  parseRows,
  type RowMapping,
  deriveO2Bands,
  bandIndexFor,
  type O2Band,
  computeMaterialMetrics,
  computeEvidenceScores,
  type EvidenceWeights,
  summarizeForInterpretation,
} from '@/lib/combustion'

// ── fixtures ─────────────────────────────────────────────────────────

// Mirrors the live "BASS-II" dataset column layout (keys + labels).
const bass2Columns = [
  { key: 'material', label: 'Material', type: 'category', unit: null, canonicalField: null },
  { key: 'test_no', label: 'Test No.', type: 'text', unit: null, canonicalField: null },
  { key: 'thickness', label: 'Thickness', type: 'text', unit: null, canonicalField: null },
  { key: 'flow_restrictor', label: 'Flow restrictor', type: 'integer', unit: null, canonicalField: null },
  { key: 'air_velocity_cm_s_start', label: 'Air_Velocity_cm_s_Start', type: 'number', unit: null, canonicalField: null },
  { key: 'air_velocity_cm_s_end', label: 'Air_Velocity_cm_s_End', type: 'number', unit: null, canonicalField: null },
  { key: 'air_velocity_cm_s_1', label: 'Air_Velocity_cm_s_1', type: 'number', unit: null, canonicalField: null },
  { key: 'calibrated_initial_o2', label: 'Calibrated initial O2', type: 'number', unit: '%', canonicalField: null },
  { key: 'calibrated_final_o2', label: 'Calibrated final O2', type: 'number', unit: '%', canonicalField: null },
  { key: 'initial_co2', label: 'Initial CO2', type: 'number', unit: '%', canonicalField: null },
  { key: 'final_co2', label: 'Final CO2', type: 'number', unit: '%', canonicalField: null },
  { key: 'initial_co', label: 'Initial CO', type: 'number', unit: 'ppm', canonicalField: null },
  { key: 'final_co', label: 'Final CO', type: 'number', unit: 'ppm', canonicalField: null },
]

type Col = { key: string; label: string; type: string; unit: string | null; canonicalField: string | null }

// A dataset where an admin mapped one O2 column to the o2Percent canonical
// field — this is what triggers the double-mapping bug.
const canonColumns = [
  ...bass2Columns.map((c) => ({ ...c })),
  // (placeholder, replaced below)
]

// ── classifyReading ───────────────────────────────────────────────────

describe('classifyReading', () => {
  it('classifies finite numbers as valid', () => {
    expect(classifyReading(22.2)).toEqual({ kind: 'valid', value: 22.2, raw: null })
    expect(classifyReading(0)).toEqual({ kind: 'valid', value: 0, raw: null })
    expect(classifyReading(-1)).toEqual({ kind: 'valid', value: -1, raw: null })
  })

  it('parses numeric strings as valid', () => {
    expect(classifyReading('22.2').kind).toBe('valid')
    expect(classifyReading('1,234').value).toBe(1234)
  })

  it('classifies empty and null-like values as missing', () => {
    for (const v of [null, undefined, '', '   ', 'none', 'n/a', 'N/A', 'null', 'nan']) {
      expect(classifyReading(v).kind).toBe('missing')
    }
  })

  it('classifies comparison-operator markers as out-of-range, preserving the raw text', () => {
    for (const v of ['>500', '>=500', '<1', '< 10', '> 500']) {
      const r = classifyReading(v)
      expect(r.kind).toBe('outOfRange')
      expect(r.value).toBeNull()
      expect(r.raw).toBe(v)
    }
  })

  it('classifies out-of-range words as censored, preserving the raw text', () => {
    for (const v of ['OR', 'or', 'over', 'Over', 'out of range', 'OOR', 'saturation', 'sat']) {
      const r = classifyReading(v)
      expect(r.kind).toBe('censored')
      expect(r.value).toBeNull()
      expect(r.raw).toBe(v)
    }
  })

  it('classifies unrecognized strings as invalid', () => {
    expect(classifyReading('banana').kind).toBe('invalid')
    expect(classifyReading('300+   +102').kind).toBe('invalid')
  })

  it('distinguishes missing from censored and out-of-range', () => {
    const kinds = [classifyReading(''), classifyReading('OR'), classifyReading('>500')].map((r) => r.kind)
    expect(new Set(kinds).size).toBe(3)
  })
})

// ── resolveColumn ────────────────────────────────────────────────────

describe('resolveColumn', () => {
  it('prefers the administrator-configured canonical mapping over heuristics', () => {
    const cols: Col[] = bass2Columns.map((c) => ({ ...c }))
    cols.find((c) => c.key === 'calibrated_final_o2')!.canonicalField = 'o2Percent'
    const res = resolveColumn(cols, { role: 'o2Final', canon: 'o2Percent' })
    expect(res.column?.key).toBe('calibrated_final_o2')
  })

  it('resolves exact source-column keys without substring fallback', () => {
    const res = resolveColumn(bass2Columns, { role: 'o2Initial', exactKeys: ['o2_initial'] })
    expect(res.column).toBeNull() // no such key in the BASS-II dataset; must NOT fuzzy-match
    expect(res.ambiguous).toEqual([])
  })

  it('resolves exact case-insensitive label matches', () => {
    const res = resolveColumn(bass2Columns, {
      role: 'coInitial',
      exactKeys: ['co_initial'],
      exactLabels: ['Initial CO'],
    })
    expect(res.column?.key).toBe('initial_co')
  })

  it('does not confuse Initial CO with Initial CO2 via substring matching', () => {
    const res = resolveColumn(bass2Columns, {
      role: 'coInitial',
      exactKeys: ['co_initial', 'initial_co'],
      exactLabels: ['Initial CO'],
    })
    expect(res.column?.key).toBe('initial_co')
    expect(res.column?.key).not.toBe('initial_co2')
  })

  it('flags ambiguity when a fuzzy pattern matches multiple columns', () => {
    const res = resolveColumn(bass2Columns, {
      role: 'airVelocity',
      exactKeys: ['air_velocity'],
      exactLabels: ['Air Velocity'],
      fuzzy: ['air_velocity'],
    })
    expect(res.column).toBeNull()
    expect(res.ambiguous.length).toBeGreaterThan(1)
    expect(res.note).toMatch(/ambiguous/i)
  })

  it('resolves a unique fuzzy match', () => {
    const res = resolveColumn(bass2Columns, {
      role: 'o2Initial',
      fuzzy: ['calibrated initial o2'],
    })
    expect(res.column?.key).toBe('calibrated_initial_o2')
  })

  it('never returns the same column for initial and final O2 lookups on the BASS-II layout', () => {
    const initial = resolveColumn(bass2Columns, {
      role: 'o2Initial',
      exactKeys: ['o2_initial', 'initial_o2'],
      exactLabels: ['Calibrated initial O2'],
      fuzzy: ['initial_o2', 'calibrated initial o2'],
    })
    const final = resolveColumn(bass2Columns, {
      role: 'o2Final',
      exactKeys: ['o2_final', 'final_o2'],
      exactLabels: ['Calibrated final O2'],
      fuzzy: ['final_o2', 'calibrated final o2'],
    })
    expect(initial.column?.key).toBe('calibrated_initial_o2')
    expect(final.column?.key).toBe('calibrated_final_o2')
    expect(initial.column?.key).not.toBe(final.column?.key)
  })
})

// ── resolveColumnSet ─────────────────────────────────────────────────

describe('resolveColumnSet', () => {
  it('detects when two roles resolve to the same column (duplicate mapping)', () => {
    const specs: ColumnSpec[] = [
      { role: 'o2Initial', canon: 'o2Percent' },
      { role: 'o2Final', canon: 'o2Percent' },
    ]
    const resolutions = resolveColumnSet(bass2Columns, specs)
    // No canon mapping in this fixture → both unresolved, no false duplicate
    expect(resolutions.o2Initial.column).toBeNull()
    expect(resolutions.o2Final.column).toBeNull()
  })

  it('reports a duplicate when both roles resolve to one canonical-mapped column', () => {
    const cols: Col[] = bass2Columns.map((c) => ({ ...c }))
    for (const c of cols) c.canonicalField = null
    cols.find((c) => c.key === 'calibrated_initial_o2')!.canonicalField = 'o2Percent'
    const specs: ColumnSpec[] = [
      { role: 'o2Initial', canon: 'o2Percent' },
      { role: 'o2Final', canon: 'o2Percent' },
    ]
    const resolutions = resolveColumnSet(cols, specs)
    const dupes = Object.values(resolutions).filter(
      (r) => r.column && Object.values(resolutions).some((o) => o !== r && o.column?.key === r.column?.key),
    )
    expect(dupes.length).toBeGreaterThan(0)
  })
})

// ── parseRows ────────────────────────────────────────────────────────

describe('parseRows', () => {
  const mapping: RowMapping = {
    material: 'material',
    testNo: 'test_no',
    thickness: 'thickness',
    flowRest: 'flow_restrictor',
    airVel: 'air_velocity_cm_s_start',
    o2i: 'calibrated_initial_o2',
    o2f: 'calibrated_final_o2',
    coi: 'initial_co',
    cof: 'final_co',
    co2i: 'initial_co2',
    co2f: 'final_co2',
    pi: null,
    date: null,
    frames: null,
  }

  it('computes O2 consumed only when initial and final readings are valid', () => {
    const rows = parseRows(
      [
        { material: 'PMMA', calibrated_initial_o2: 22.2, calibrated_final_o2: 20.0 },
        { material: 'PMMA', calibrated_initial_o2: 21.0 }, // missing final
        { material: 'PMMA', calibrated_final_o2: 19.0 }, // missing initial
      ] as never,
      mapping,
    )
    expect(rows[0].o2Consumed).toBeCloseTo(2.2)
    expect(rows[1].o2Consumed).toBeNull()
    expect(rows[2].o2Consumed).toBeNull()
  })

  it('does not compute O2 consumed when initial and final come from the same source column', () => {
    const badMapping = { ...mapping, o2i: 'calibrated_initial_o2', o2f: 'calibrated_initial_o2' }
    const rows = parseRows([{ material: 'PMMA', calibrated_initial_o2: 22.2 }] as never, badMapping)
    expect(rows[0].o2Consumed).toBeNull()
    expect(rows[0].mappingWarnings.join(' ')).toMatch(/same source column/i)
  })

  it('classifies censored markers from rawData instead of treating them as valid numbers', () => {
    const rows = parseRows(
      [
        { material: 'PMMA', final_co: null, _rawData: { final_co: '>500' } },
        { material: 'PMMA', final_co: null, _rawData: { final_co: 'OR' } },
        { material: 'PMMA', final_co: 120 },
        { material: 'PMMA', final_co: null },
      ] as never,
      mapping,
    )
    expect(rows[0].readingClasses.cof).toBe('outOfRange')
    expect(rows[1].readingClasses.cof).toBe('censored')
    expect(rows[2].readingClasses.cof).toBe('valid')
    expect(rows[3].readingClasses.cof).toBe('missing')
  })

  it('counts CO produced only from valid initial and final readings', () => {
    const rows = parseRows(
      [
        { material: 'PMMA', initial_co: 10, final_co: 600 },
        { material: 'PMMA', initial_co: null, final_co: null, _rawData: { initial_co: 'OR' } },
      ] as never,
      mapping,
    )
    expect(rows[0].coProduced).toBe(590)
    expect(rows[1].coProduced).toBeNull()
    expect(rows[1].readingClasses.coi).toBe('censored')
  })
})

// ── deriveO2Bands ────────────────────────────────────────────────────

describe('deriveO2Bands', () => {
  it('derives fixed-width bands covering the observed O2 range', () => {
    const bands = deriveO2Bands([13.6, 14.2, 20.1, 22.2, 19.0], { widthPct: 2 })
    expect(bands.length).toBeGreaterThan(1)
    expect(bands[0].max).toBeLessThanOrEqual(bands[1].min + 1e-9)
    expect(bands[0].min).toBeLessThanOrEqual(13.6)
    expect(bands[bands.length - 1].max).toBeGreaterThanOrEqual(22.2)
    expect(bands.every((b) => b.width === 2)).toBe(true)
  })

  it('keeps band boundaries consistent (every band has the same width)', () => {
    const bands = deriveO2Bands([15.1, 16.9], { widthPct: 1 })
    expect(new Set(bands.map((b) => b.width)).size).toBe(1)
  })

  it('returns no bands when no valid O2 readings exist', () => {
    expect(deriveO2Bands([], { widthPct: 1 })).toEqual([])
  })

  it('counts tests per band with material membership', () => {
    const bands = deriveO2Bands([20.0, 20.5, 21.0], { widthPct: 1 })
    const target = bands.find((b) => 20.0 >= b.min && 20.0 < b.max)
    expect(target).toBeDefined()
    // 21.0 is the top edge of the only band here, so all three readings land
    // in it — the maximum observed reading must never be dropped.
    expect(target!.count).toBe(3)
  })

  it('places a reading exactly on the top band boundary in the top band', () => {
    // 21 is the upper edge of the last band when bands run 15–21.
    const bands = deriveO2Bands([15, 16, 21], { widthPct: 1 })
    expect(bandIndexFor(bands, 21)).toBe(bands.length - 1)
    expect(bands[bands.length - 1].count).toBe(1)
    // every value must be counted exactly once
    expect(bands.reduce((s, b) => s + b.count, 0)).toBe(3)
  })

  it('places a reading exactly on an interior boundary in the upper band', () => {
    const bands = deriveO2Bands([15, 16, 17], { widthPct: 1 })
    expect(bandIndexFor(bands, 16)).toBe(1) // [16,17)
    expect(bandIndexFor(bands, 15)).toBe(0)
  })
})

// ── computeMaterialMetrics ───────────────────────────────────────────

describe('computeMaterialMetrics', () => {
  const mapping: RowMapping = {
    material: 'material',
    testNo: 'test_no',
    thickness: null,
    flowRest: 'flow_restrictor',
    airVel: 'air_velocity_cm_s_start',
    o2i: 'calibrated_initial_o2',
    o2f: 'calibrated_final_o2',
    coi: 'initial_co',
    cof: 'final_co',
    co2i: 'initial_co2',
    co2f: 'final_co2',
    pi: null,
    date: null,
    frames: null,
  }

  const rows = parseRows(
    [
      { material: 'PMMA', calibrated_initial_o2: 20, calibrated_final_o2: 18, initial_co: 0, final_co: 100, initial_co2: 0.4, final_co2: 1.0 },
      { material: 'PMMA', calibrated_initial_o2: 21, calibrated_final_o2: 19.5, initial_co: 5, final_co: 200, initial_co2: null, final_co2: null, _rawData: { final_co2: 'over' } },
      { material: 'SIBAL', calibrated_initial_o2: 15, calibrated_final_o2: 14, initial_co: 0, final_co: 300, initial_co2: 0.4, final_co2: 2.0 },
    ] as never,
    mapping,
  )

  it('counts tests, distinct O2 conditions, and O2 range per material', () => {
    const bands = deriveO2Bands(rows.map((r) => r.o2i).filter((v): v is number => v !== null), { widthPct: 1 })
    const metrics = computeMaterialMetrics(rows, bands)
    const pmma = metrics.find((m) => m.material === 'PMMA')!
    const sibal = metrics.find((m) => m.material === 'SIBAL')!
    expect(pmma.tests).toBe(2)
    expect(sibal.tests).toBe(1)
    expect(pmma.o2Conditions).toBe(2)
    expect(pmma.o2Range).toBeCloseTo(1)
    expect(sibal.o2Range).toBeCloseTo(0)
    expect(sibal.o2BandsCovered).toBe(1)
    expect(pmma.o2BandsCovered).toBeGreaterThanOrEqual(1)
  })

  it('reports the O2 range without floating-point noise', () => {
    const rows = parseRows(
      [
        { material: 'SIBAL', calibrated_initial_o2: 16.4, calibrated_final_o2: 15.0 },
        { material: 'SIBAL', calibrated_initial_o2: 20.8, calibrated_final_o2: 19.0 },
      ] as never,
      mapping,
    )
    const metrics = computeMaterialMetrics(rows, [])
    // 20.8 - 16.4 is 4.400000000000002 in binary floating point.
    expect(metrics[0].o2Range).toBe(4.4)
  })

  it('reports mean O2 consumed with the sample size behind it', () => {
    const bands = deriveO2Bands([15, 20, 21], { widthPct: 1 })
    const metrics = computeMaterialMetrics(rows, bands)
    const pmma = metrics.find((m) => m.material === 'PMMA')!
    expect(pmma.o2ConsumedMean).toBeCloseTo((2 + 1.5) / 2)
    expect(pmma.o2ConsumedN).toBe(2)
  })

  it('tracks censored and missing readings per gas metric', () => {
    const bands = deriveO2Bands([15, 20, 21], { widthPct: 1 })
    const metrics = computeMaterialMetrics(rows, bands)
    const pmma = metrics.find((m) => m.material === 'PMMA')!
    expect(pmma.excluded.censored).toBeGreaterThanOrEqual(1) // co2f 'over'
    expect(pmma.excluded.censoredPlusOOR).toBeGreaterThanOrEqual(1)
    expect(pmma.excluded.missing).toBeGreaterThanOrEqual(1) // co2i of row 2
  })

  it('does not treat missing O2 as zero coverage', () => {
    const rowsNoO2 = parseRows([{ material: 'PMMA', o2i: null, o2f: null }] as never, mapping)
    const bands = deriveO2Bands([], { widthPct: 1 })
    const metrics = computeMaterialMetrics(rowsNoO2, bands)
    expect(metrics[0].o2Conditions).toBe(0)
    expect(metrics[0].hasO2Data).toBe(false)
  })
})

// ── computeEvidenceScores ────────────────────────────────────────────

describe('computeEvidenceScores', () => {
  const weights: EvidenceWeights = { testCoverage: 0.5, o2Diversity: 0.3, o2Range: 0.2 }

  it('normalizes components to 0-100 and combines them with normalized weights', () => {
    const metrics = [
      { material: 'A', tests: 10, o2Conditions: 5, o2Range: 6, o2ConsumedMean: 2, o2ConsumedN: 10, excluded: { censored: 0, outOfRange: 0, missing: 0, censoredPlusOOR: 0 }, hasO2Data: true, o2BandsCovered: 6, coMean: null, coN: 0, co2Mean: null, co2N: 0 },
      { material: 'B', tests: 5, o2Conditions: 2, o2Range: 2, o2ConsumedMean: null, o2ConsumedN: 0, excluded: { censored: 0, outOfRange: 0, missing: 0, censoredPlusOOR: 0 }, hasO2Data: true, o2BandsCovered: 2, coMean: null, coN: 0, co2Mean: null, co2N: 0 },
    ] as never
    const scored = computeEvidenceScores(metrics, weights)
    const a = scored.find((s) => s.material === 'A')!
    const b = scored.find((s) => s.material === 'B')!
    // A leads every component
    expect(a.components.testCoverage).toBe(100)
    expect(b.components.testCoverage).toBe(50)
    expect(a.components.o2Diversity).toBe(100)
    expect(a.components.o2Range).toBe(100)
    expect(a.score!).toBeCloseTo(100)
    expect(b.score!).toBeLessThan(a.score!)
    expect(a.rank!).toBeLessThan(b.rank!)
  })

  it('normalizes the weights so their sum is 1', () => {
    const metrics = [
      { material: 'A', tests: 1, o2Conditions: 1, o2Range: 1, o2ConsumedMean: null, o2ConsumedN: 0, excluded: { censored: 0, outOfRange: 0, missing: 0, censoredPlusOOR: 0 }, hasO2Data: true, o2BandsCovered: 1, coMean: null, coN: 0, co2Mean: null, co2N: 0 },
    ] as never
    const scored = computeEvidenceScores(metrics, { testCoverage: 2, o2Diversity: 1, o2Range: 1 })
    expect(scored[0].weights.testCoverage).toBeCloseTo(0.5)
    expect(scored[0].weights.o2Diversity).toBeCloseTo(0.25)
    expect(scored[0].weights.o2Range).toBeCloseTo(0.25)
    // Single material covers everything → 100
    expect(scored[0].score!).toBeCloseTo(100)
  })

  it('ties receive the same rank and are displayed transparently', () => {
    const metrics = [
      { material: 'A', tests: 5, o2Conditions: 2, o2Range: 2, o2ConsumedMean: null, o2ConsumedN: 0, excluded: { censored: 0, outOfRange: 0, missing: 0, censoredPlusOOR: 0 }, hasO2Data: true, o2BandsCovered: 2, coMean: null, coN: 0, co2Mean: null, co2N: 0 },
      { material: 'B', tests: 5, o2Conditions: 2, o2Range: 2, o2ConsumedMean: null, o2ConsumedN: 0, excluded: { censored: 0, outOfRange: 0, missing: 0, censoredPlusOOR: 0 }, hasO2Data: true, o2BandsCovered: 2, coMean: null, coN: 0, co2Mean: null, co2N: 0 },
    ] as never
    const scored = computeEvidenceScores(metrics, weights)
    expect(scored[0].score!).toBeCloseTo(scored[1].score!)
    expect(scored[0].rank).toBe(scored[1].rank)
  })

  it('does not treat a material without O2 data as zero-coverage when others have data', () => {
    const metrics = [
      { material: 'A', tests: 5, o2Conditions: 2, o2Range: 2, o2ConsumedMean: null, o2ConsumedN: 0, excluded: { censored: 0, outOfRange: 0, missing: 0, censoredPlusOOR: 0 }, hasO2Data: true, o2BandsCovered: 2, coMean: null, coN: 0, co2Mean: null, co2N: 0 },
      { material: 'B', tests: 5, o2Conditions: 0, o2Range: 0, o2ConsumedMean: null, o2ConsumedN: 0, excluded: { censored: 0, outOfRange: 0, missing: 0, censoredPlusOOR: 0 }, hasO2Data: false, o2BandsCovered: 0, coMean: null, coN: 0, co2Mean: null, co2N: 0 },
    ] as never
    const scored = computeEvidenceScores(metrics, weights)
    const b = scored.find((s) => s.material === 'B')!
    expect(b.components.o2Diversity).toBeNull() // unknown, not zero
    expect(b.components.o2Range).toBeNull()
    expect(b.score).not.toBeNull() // still scored on test coverage
  })
})

// ── summarizeForInterpretation ───────────────────────────────────────

describe('summarizeForInterpretation', () => {
  it('produces a compact summary without raw rows', () => {
    const mapping: RowMapping = {
      material: 'material', testNo: null, thickness: null, flowRest: null, airVel: null,
      o2i: 'calibrated_initial_o2', o2f: 'calibrated_final_o2', coi: 'initial_co', cof: 'final_co',
      co2i: 'initial_co2', co2f: 'final_co2', pi: null, date: null, frames: null,
    }
    const rows = parseRows(
      [
        { material: 'PMMA', calibrated_initial_o2: 20, calibrated_final_o2: 18, initial_co: 0, final_co: 100, initial_co2: 0.4, final_co2: 1.0 },
        { material: 'PMMA', calibrated_initial_o2: 21, calibrated_final_o2: 19.5, initial_co: 5, final_co: 200, initial_co2: 0.4, final_co2: 1.2 },
        { material: 'SIBAL', calibrated_initial_o2: 15, calibrated_final_o2: 14, initial_co: 0, final_co: 300, initial_co2: 0.4, final_co2: 2.0 },
      ] as never,
      mapping,
    )
    const summary = summarizeForInterpretation(rows, 'BASS-II')
    expect(summary.totalTests).toBe(3)
    expect(summary.materials).toEqual(['PMMA', 'SIBAL'])
    expect(summary.byMaterial['PMMA'].tests).toBe(2)
    expect(summary.byMaterial['PMMA'].meanO2Consumed).toBeCloseTo(1.75)
    // no raw row payload
    expect(JSON.stringify(summary)).not.toContain('co2i')
  })
})

// keep references so unused-import lint passes on the const fixtures above
export type _Keep = ColumnResolution | O2Band
void canonColumns
