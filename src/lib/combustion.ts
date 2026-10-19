/**
 * Pure, framework-free dashboard logic for the BASS-II fire-safety dashboard.
 *
 * Everything here is deterministic and side-effect free so it can be unit
 * tested without React, Payload, or a browser, and reused by both the
 * server (interpretation summaries) and client components (charts, ranking,
 * heatmap).
 *
 * Scientific-grounding rules encoded here:
 *  - Censored / out-of-range readings are never silently treated as missing
 *    numbers or as zero. They are counted and reported separately.
 *  - O2 consumption is only computed when the initial and final readings are
 *    independently resolved to *different* source columns and both are valid.
 *  - Evidence scores measure how much the dataset tells us about a material,
 *    never how dangerous the material is.
 */

/* ------------------------------------------------------------------ */
/* Reading classification                                              */
/* ------------------------------------------------------------------ */

export type ReadingClass = 'valid' | 'missing' | 'censored' | 'outOfRange' | 'invalid'

export type ClassifiedReading = {
  kind: ReadingClass
  value: number | null
  /** Original text for censored/out-of-range markers (">500", "OR", ...). */
  raw: string | null
}

/** Words that mean "no measurement was taken" rather than a saturated sensor. */
const MISSING_WORDS = new Set(['', 'none', 'n/a', 'na', 'null', 'nan', 'n.m.', 'not measured'])
/** Words that mean "the sensor could not produce a finite number" (saturation etc.). */
const CENSORED_WORDS = new Set([
  'or', // out of range (as recorded in the BASS-II sheets)
  'oor',
  'over',
  'over-range',
  'out of range',
  'out-of-range',
  'sat',
  'saturated',
  'saturation',
  'beyond range',
  'beyond sensor range',
  'hi',
  'high',
])

/**
 * Classify one raw reading. Preserves the original marker text so the UI can
 * show exactly what the source sheet said instead of inventing a number.
 */
export function classifyReading(raw: unknown): ClassifiedReading {
  if (raw === null || raw === undefined) return { kind: 'missing', value: null, raw: null }

  if (typeof raw === 'number') {
    return Number.isFinite(raw)
      ? { kind: 'valid', value: raw, raw: null }
      : { kind: 'invalid', value: null, raw: String(raw) }
  }
  if (typeof raw !== 'string') return { kind: 'invalid', value: null, raw: String(raw) }

  const text = raw.trim()
  if (text === '') return { kind: 'missing', value: null, raw: null }
  const lower = text.toLowerCase()
  if (MISSING_WORDS.has(lower)) return { kind: 'missing', value: null, raw: null }

  const n = Number(text.replace(/,/g, ''))
  if (text !== '' && Number.isFinite(n)) return { kind: 'valid', value: n, raw: null }

  // Comparison markers such as ">500" or "<1" are one-sided bounds, not values.
  if (/^(>=?|<=?)\s*-?(\d+(\.\d+)?)\s*%?$/.test(text)) {
    return { kind: 'outOfRange', value: null, raw: text }
  }
  if (CENSORED_WORDS.has(lower)) return { kind: 'censored', value: null, raw: text }

  return { kind: 'invalid', value: null, raw: text }
}

/* ------------------------------------------------------------------ */
/* Column resolution                                                   */
/* ------------------------------------------------------------------ */

export type ColumnLike = {
  key: string
  label: string
  canonicalField?: string | null
  [extra: string]: unknown
}

export type ColumnSpec = {
  role: string
  /** Administrator-configured canonical mapping; wins over every heuristic. */
  canon?: string | null
  /** Exact source-column keys, tried in order. */
  exactKeys?: string[]
  /** Exact (case-insensitive) column labels, tried in order. */
  exactLabels?: string[]
  /** Last-resort substring patterns; only allowed to resolve when unique. */
  fuzzy?: string[]
}

export type ColumnResolution = {
  role: string
  column: ColumnLike | null
  /** Columns a last-resort pattern matched; non-empty means "ambiguous". */
  ambiguous: ColumnLike[]
  note: string | null
}

const lower = (s: string) => s.trim().toLowerCase()

/**
 * Resolve one logical role to a source column.
 *
 * Order: admin canonical mapping → exact key → exact label → unique fuzzy
 * substring. Substring matching is deliberately last and must be unique:
 * patterns like "initial_co" would otherwise confuse `initial_co` with
 * `initial_co2`. When a pattern matches several columns we flag the ambiguity
 * instead of silently picking one.
 */
export function resolveColumn(cols: ColumnLike[], spec: ColumnSpec): ColumnResolution {
  if (spec.canon) {
    const mapped = cols.find((c) => c.canonicalField === spec.canon)
    if (mapped) return { role: spec.role, column: mapped, ambiguous: [], note: null }
  }
  for (const k of spec.exactKeys ?? []) {
    const c = cols.find((x) => x.key === k)
    if (c) return { role: spec.role, column: c, ambiguous: [], note: null }
  }
  for (const l of spec.exactLabels ?? []) {
    const target = lower(l)
    const c = cols.find((x) => lower(x.label) === target)
    if (c) return { role: spec.role, column: c, ambiguous: [], note: null }
  }
  let ambiguous: ColumnLike[] = []
  for (const p of spec.fuzzy ?? []) {
    const needle = lower(p)
    if (!needle) continue
    const matches = cols.filter((c) => lower(c.key).includes(needle) || lower(c.label).includes(needle))
    if (matches.length === 1) return { role: spec.role, column: matches[0], ambiguous: [], note: null }
    if (matches.length > 1) ambiguous = matches
  }
  if (ambiguous.length > 0) {
    const names = [...new Set(ambiguous.map((c) => c.label))].join('", "')
    return {
      role: spec.role,
      column: null,
      ambiguous,
      note: `Ambiguous: "${spec.role}" matches ${ambiguous.length} columns ("${names}"). Set an explicit mapping instead of guessing.`,
    }
  }
  return { role: spec.role, column: null, ambiguous: [], note: null }
}

/** Resolve a whole set of roles; returns one resolution per role key. */
export function resolveColumnSet<T extends ColumnSpec>(
  cols: ColumnLike[],
  specs: T[],
): Record<string, ColumnResolution> {
  const out: Record<string, ColumnResolution> = {}
  for (const spec of specs) out[spec.role] = resolveColumn(cols, spec)
  return out
}

/** Roles that ended up pointing at the same source column (a mapping bug). */
export function findDuplicateMappings(resolutions: Record<string, ColumnResolution>): string[] {
  const byColumn = new Map<string, string[]>()
  for (const [role, res] of Object.entries(resolutions)) {
    if (!res.column) continue
    const list = byColumn.get(res.column.key) ?? []
    list.push(role)
    byColumn.set(res.column.key, list)
  }
  const dupes: string[] = []
  for (const roles of byColumn.values()) if (roles.length > 1) dupes.push(roles.join(' = '))
  return dupes
}

/* ------------------------------------------------------------------ */
/* Row parsing                                                         */
/* ------------------------------------------------------------------ */

export type RowMapping = {
  material: string | null
  testNo: string | null
  thickness: string | null
  flowRest: string | null
  airVel: string | null
  o2i: string | null
  o2f: string | null
  coi: string | null
  cof: string | null
  co2i: string | null
  co2f: string | null
  pi: string | null
  date: string | null
  frames: string | null
}

export type GasField = 'o2i' | 'o2f' | 'coi' | 'cof' | 'co2i' | 'co2f'

export type ParsedRow = {
  /** Index into the original raw rows array (for rawData lookup). */
  _idx: number
  material: string
  testNo: string | null
  thickness: number | null
  flowRest: string | null
  airVel: number | null
  o2i: number | null
  o2f: number | null
  o2Consumed: number | null
  coi: number | null
  cof: number | null
  coProduced: number | null
  co2i: number | null
  co2f: number | null
  co2Produced: number | null
  pi: string | null
  date: string | null
  frames: number | null
  readingClasses: Partial<Record<GasField, ReadingClass>>
  mappingWarnings: string[]
}

type RawRow = Record<string, unknown> & { _rawData?: Record<string, string> | null }

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''))
    return v.trim() !== '' && Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Parse raw dataset rows into chart-ready values.
 *
 * `_rawData` carries the original source text for readings that could not be
 * stored as numbers (e.g. ">500"); those are classified as censored or
 * out-of-range rather than as ordinary missing values.
 */
export function parseRows(rows: RawRow[], mapping: RowMapping): ParsedRow[] {
  const warnings: string[] = []
  // O2 consumption must come from two *independently resolved* columns.
  if (mapping.o2i && mapping.o2f && mapping.o2i === mapping.o2f) {
    warnings.push(
      `Initial and final O2 both resolve to the same source column ("${mapping.o2i}"); O2 consumption is not calculated.`,
    )
  }

  return rows.map((r, idx) => {
    const rawData = r._rawData ?? {}
    const read = (key: string | null): ClassifiedReading => {
      if (!key) return { kind: 'missing', value: null, raw: null }
      const rawText = rawData[key]
      if (rawText !== undefined && String(rawText).trim() !== '') return classifyReading(rawText)
      return classifyReading(r[key])
    }

    const o2iR = read(mapping.o2i)
    const o2fR = read(mapping.o2f)
    const coiR = read(mapping.coi)
    const cofR = read(mapping.cof)
    const co2iR = read(mapping.co2i)
    const co2fR = read(mapping.co2f)

    const o2Consumed =
      o2iR.kind === 'valid' && o2fR.kind === 'valid' && mapping.o2i !== mapping.o2f
        ? (o2iR.value as number) - (o2fR.value as number)
        : null

    return {
      _idx: idx,
      material: str(r[mapping.material ?? '']) ?? 'Unknown',
      testNo: str(r[mapping.testNo ?? '']),
      thickness: num(r[mapping.thickness ?? '']),
      flowRest: str(r[mapping.flowRest ?? '']),
      airVel: num(r[mapping.airVel ?? '']),
      o2i: o2iR.value,
      o2f: o2fR.value,
      o2Consumed,
      coi: coiR.value,
      cof: cofR.value,
      coProduced: coiR.kind === 'valid' && cofR.kind === 'valid' ? Math.max(0, (cofR.value as number) - (coiR.value as number)) : null,
      co2i: co2iR.value,
      co2f: co2fR.value,
      co2Produced: co2iR.kind === 'valid' && co2fR.kind === 'valid' ? (co2fR.value as number) - (co2iR.value as number) : null,
      pi: str(r[mapping.pi ?? '']),
      date: str(r[mapping.date ?? '']),
      frames: num(r[mapping.frames ?? '']),
      readingClasses: {
        o2i: o2iR.kind,
        o2f: o2fR.kind,
        coi: coiR.kind,
        cof: cofR.kind,
        co2i: co2iR.kind,
        co2f: co2fR.kind,
      },
      mappingWarnings: warnings,
    }
  })
}

/* ------------------------------------------------------------------ */
/* O2 bands                                                            */
/* ------------------------------------------------------------------ */

export type O2Band = {
  min: number
  max: number
  width: number
  label: string
  count: number
  materials: Set<string>
}

export type BandConfig = {
  /** Band width in O2 percentage points. Default 1. */
  widthPct?: number
}

/**
 * Derive oxygen-concentration bands from the actual data distribution using a
 * fixed, documented binning rule: equal-width bins aligned to whole
 * percentages, spanning the observed range. The same rule is used by the
 * heatmap and the ranking panel so boundaries never disagree.
 */
export function deriveO2Bands(values: number[], config: BandConfig = {}): O2Band[] {
  const width = config.widthPct && config.widthPct > 0 ? config.widthPct : 1
  if (values.length === 0) return []
  const finite = values.filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (finite.length === 0) return []

  const lo = Math.floor(Math.min(...finite) / width) * width
  const hi = Math.ceil(Math.max(...finite) / width) * width

  const bands: O2Band[] = []
  const n = Math.max(1, Math.round((hi - lo) / width))
  for (let i = 0; i < n; i++) {
    const a = round2(lo + i * width)
    const b = round2(lo + (i + 1) * width)
    bands.push({
      min: a,
      max: b,
      width: round2(b - a),
      label: `${a}–${b}%`,
      count: 0,
      materials: new Set(),
    })
  }
  for (const v of finite) {
    const idx = bandIndexFor(bands, v)
    if (idx >= 0) bands[idx].count += 1
  }
  return bands
}

/**
 * Index of the band a reading belongs to, or -1 when it is outside the range.
 *
 * Bands are half-open [min, max) so a value never lands in two bands, except
 * for the very top edge: a reading exactly equal to the highest band's upper
 * bound belongs to that last band (otherwise the maximum observed reading
 * would silently disappear from the heatmap).
 */
export function bandIndexFor(bands: O2Band[], value: number): number {
  if (bands.length === 0 || !Number.isFinite(value)) return -1
  const first = bands[0]
  const last = bands[bands.length - 1]
  if (value < first.min || value > last.max) return -1
  if (value === last.max) return bands.length - 1
  return bands.findIndex((b) => value >= b.min && value < b.max)
}

/* ------------------------------------------------------------------ */
/* Per-material metrics                                                */
/* ------------------------------------------------------------------ */

export type MaterialMetrics = {
  material: string
  tests: number
  /** Distinct valid starting-O2 conditions tested. */
  o2Conditions: number
  /** Max minus min of valid starting O2; null when nothing valid exists. */
  o2Range: number | null
  o2BandsCovered: number
  hasO2Data: boolean
  o2ConsumedMean: number | null
  o2ConsumedN: number
  coProducedMean: number | null
  coProducedN: number
  co2ProducedMean: number | null
  co2ProducedN: number
  excluded: {
    censored: number
    outOfRange: number
    censoredPlusOOR: number
    missing: number
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100

export function computeMaterialMetrics(rows: ParsedRow[], bands: O2Band[]): MaterialMetrics[] {
  const groups = new Map<string, ParsedRow[]>()
  for (const r of rows) {
    const list = groups.get(r.material) ?? []
    list.push(r)
    groups.set(r.material, list)
  }

  const metrics: MaterialMetrics[] = []
  for (const [material, group] of groups) {
    const validO2 = group.map((r) => r.o2i).filter((v): v is number => v !== null)
    const distinctO2 = new Set(validO2.map(round2))
    const o2Range = validO2.length > 0 ? round2(Math.max(...validO2) - Math.min(...validO2)) : null

    const covered = new Set<number>()
    for (const v of validO2) {
      const idx = bandIndexFor(bands, v)
      if (idx >= 0) {
        covered.add(idx)
        bands[idx].materials.add(material)
      }
    }

    const consumed = group.map((r) => r.o2Consumed).filter((v): v is number => v !== null)
    const co = group.map((r) => r.coProduced).filter((v): v is number => v !== null)
    const co2 = group.map((r) => r.co2Produced).filter((v): v is number => v !== null)

    let censored = 0
    let outOfRange = 0
    let missing = 0
    for (const r of group) {
      for (const k of Object.values(r.readingClasses)) {
        if (k === 'censored') censored++
        else if (k === 'outOfRange') outOfRange++
        else if (k === 'missing') missing++
      }
    }

    metrics.push({
      material,
      tests: group.length,
      o2Conditions: distinctO2.size,
      o2Range,
      o2BandsCovered: covered.size,
      hasO2Data: validO2.length > 0,
      o2ConsumedMean: consumed.length ? round2(consumed.reduce((a, b) => a + b, 0) / consumed.length) : null,
      o2ConsumedN: consumed.length,
      coProducedMean: co.length ? Math.round(co.reduce((a, b) => a + b, 0) / co.length) : null,
      coProducedN: co.length,
      co2ProducedMean: co2.length ? round2(co2.reduce((a, b) => a + b, 0) / co2.length) : null,
      co2ProducedN: co2.length,
      excluded: { censored, outOfRange, censoredPlusOOR: censored + outOfRange, missing },
    })
  }
  return metrics.sort((a, b) => b.tests - a.tests || a.material.localeCompare(b.material))
}

/* ------------------------------------------------------------------ */
/* Evidence scoring                                                    */
/* ------------------------------------------------------------------ */

export type EvidenceWeights = {
  testCoverage: number
  o2Diversity: number
  o2Range: number
}

export type ScoredMaterial = MaterialMetrics & {
  weights: EvidenceWeights
  components: {
    /** Each component is 0–100, or null when the underlying data is unknown. */
    testCoverage: number | null
    o2Diversity: number | null
    o2Range: number | null
  }
  score: number | null
  rank: number | null
}

const round1 = (v: number) => Math.round(v * 100) / 100

/**
 * Evidence Score = w1·TestCoverage + w2·O2Diversity + w3·O2RangeCoverage.
 *
 * Components are normalized 0–100 against the best-covered material in the
 * current filtered view. Weights are normalized so they sum to 1. A component
 * whose data is unknown (no valid O2 readings at all) is dropped and the
 * remaining weights are renormalized — missing evidence is not zero coverage.
 *
 * This score ranks how much the dataset tells us about a material. It is NOT
 * a fire-risk score, safety rating, or ignition prediction.
 */
export function computeEvidenceScores(
  metrics: MaterialMetrics[],
  weights: EvidenceWeights,
): ScoredMaterial[] {
  const sum = weights.testCoverage + weights.o2Diversity + weights.o2Range
  const w: EvidenceWeights =
    sum > 0
      ? {
          testCoverage: weights.testCoverage / sum,
          o2Diversity: weights.o2Diversity / sum,
          o2Range: weights.o2Range / sum,
        }
      : { testCoverage: 1 / 3, o2Diversity: 1 / 3, o2Range: 1 / 3 }

  const maxTests = Math.max(0, ...metrics.map((m) => m.tests))
  const maxConditions = Math.max(0, ...metrics.map((m) => m.o2Conditions))
  const maxRange = Math.max(0, ...metrics.map((m) => m.o2Range ?? 0))

  const scored = metrics.map((m) => {
    const components = {
      testCoverage: maxTests > 0 ? round1((m.tests / maxTests) * 100) : null,
      o2Diversity: maxConditions > 0 && m.hasO2Data ? round1((m.o2Conditions / maxConditions) * 100) : null,
      o2Range: maxRange > 0 && m.hasO2Data ? round1(((m.o2Range ?? 0) / maxRange) * 100) : null,
    }
    // Drop unknown components and renormalize the remaining weights.
    const parts = [
      { weight: w.testCoverage, value: components.testCoverage },
      { weight: w.o2Diversity, value: components.o2Diversity },
      { weight: w.o2Range, value: components.o2Range },
    ].filter((p): p is { weight: number; value: number } => p.value !== null)
    const knownSum = parts.reduce((s, p) => s + p.weight, 0)
    const score =
      knownSum > 0 ? round1(parts.reduce((s, p) => s + (p.weight / knownSum) * p.value, 0)) : null

    return { ...m, weights: w, components, score, rank: null as number | null }
  })

  // Competition ranking: equal scores share a rank, shown transparently.
  scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.material.localeCompare(b.material))
  scored.forEach((m, i) => {
    m.rank = i > 0 && scored[i - 1].score === m.score ? scored[i - 1].rank : i + 1
  })
  return scored
}

/* ------------------------------------------------------------------ */
/* BASS-II column resolution (shared by every combustion view)         */
/* ------------------------------------------------------------------ */

/**
 * Resolve the combustion-analysis roles against a dataset's columns.
 *
 * Resolution order per role: administrator-configured canonical mapping →
 * exact source-column key → exact label → unique fuzzy substring (flagged
 * ambiguous when not unique). Initial and final O2 deliberately pass NO
 * canonical argument: the mapping permits only one column per canonical
 * field, so sharing "o2Percent" made both lookups resolve to the same
 * column and silently zeroed O2 consumption.
 */
export function resolveBass2Columns(cols: ColumnLike[]) {
  const specs: ColumnSpec[] = [
    { role: 'material', canon: 'material', exactKeys: ['material'], exactLabels: ['Material', 'Fuel Sample Material', 'Fuel'], fuzzy: ['material', 'fuel'] },
    { role: 'testNo', exactKeys: ['test_no', 'test'], exactLabels: ['Test No.', 'Test #'] },
    { role: 'thickness', exactKeys: ['thickness'], exactLabels: ['Thickness'] },
    { role: 'flowRest', exactKeys: ['flow_restrictor'], exactLabels: ['Flow restrictor'], fuzzy: ['flow restrictor'] },
    { role: 'airVelStart', exactKeys: ['air_velocity_cm_s_start', 'air_velocity_start'], exactLabels: ['Air_Velocity_cm_s_Start', 'Starting air velocity'], fuzzy: ['air_velocity_cm_s_start'] },
    { role: 'o2Initial', exactKeys: ['o2_initial', 'calibrated_initial_o2'], exactLabels: ['Calibrated initial O2', 'Initial O2'], fuzzy: ['initial o2', 'initial o2 ('] },
    { role: 'o2Final', exactKeys: ['o2_final', 'calibrated_final_o2'], exactLabels: ['Calibrated final O2', 'Final O2'], fuzzy: ['final o2', 'final o2 ('] },
    { role: 'coInitial', exactKeys: ['co_initial', 'initial_co'], exactLabels: ['Initial CO'], fuzzy: ['initial co', 'initial co ('] },
    { role: 'coFinal', exactKeys: ['co_final', 'final_co'], exactLabels: ['Final CO'], fuzzy: ['final co', 'final co ('] },
    { role: 'co2Initial', exactKeys: ['co2_initial', 'initial_co2'], exactLabels: ['Initial CO2', 'Initial CO₂'], fuzzy: ['initial co2', 'co2 initial'] },
    { role: 'co2Final', exactKeys: ['co2_final', 'final_co2'], exactLabels: ['Final CO2', 'Final CO₂'], fuzzy: ['final co2', 'co2 final'] },
    { role: 'pi', exactKeys: ['pi', 'principle_investigator'], exactLabels: ['Principle Investigator', 'PI'], fuzzy: ['investigator'] },
    { role: 'date', exactKeys: ['date'], exactLabels: ['Date'] },
    { role: 'frames', exactKeys: ['total_frames_shot', 'frames'], exactLabels: ['Total Frames Shot'] },
  ]
  const resolutions = resolveColumnSet(cols, specs)
  const dupes = findDuplicateMappings(resolutions)
  const warnings: string[] = [...dupes]
  for (const res of Object.values(resolutions)) if (res.note) warnings.push(res.note)
  return { resolutions, warnings }
}

/** Build a RowMapping from resolved columns; unresolved roles map to null. */
export function buildRowMapping(resolutions: Record<string, ColumnResolution>): RowMapping {
  const col = (role: string) => resolutions[role]?.column?.key ?? null
  return {
    material: col('material'),
    testNo: col('testNo'),
    thickness: col('thickness'),
    flowRest: col('flowRest'),
    airVel: col('airVelStart'),
    o2i: col('o2Initial'),
    o2f: col('o2Final'),
    coi: col('coInitial'),
    cof: col('coFinal'),
    co2i: col('co2Initial'),
    co2f: col('co2Final'),
    pi: col('pi'),
    date: col('date'),
    frames: col('frames'),
  }
}

/* ------------------------------------------------------------------ */
/* Compact interpretation summary (for the grounded AI panel)          */
/* ------------------------------------------------------------------ */

export type InterpretationSummary = {
  datasetName: string
  totalTests: number
  materials: string[]
  byMaterial: Record<
    string,
    {
      tests: number
      o2Conditions: number
      o2Min: number | null
      o2Max: number | null
      o2Range: number | null
      meanO2Consumed: number | null
      o2ConsumedN: number
      meanCoProduced: number | null
      meanCo2Produced: number | null
      excludedCensored: number
      excludedOutOfRange: number
      excludedMissing: number
    }
  >
  totalExcluded: { censored: number; outOfRange: number; missing: number }
  /** True when any gas reading was censored or out-of-range. */
  hasCensoredReadings: boolean
}

/**
 * Build a compact, validated summary of the *current filtered view* for the
 * interpretation panel. Never includes raw rows — only aggregates — so the
 * payload stays small and no unsupported claim can hide in it.
 */
export function summarizeForInterpretation(rows: ParsedRow[], datasetName: string): InterpretationSummary {
  const metrics = computeMaterialMetrics(rows, [])
  const totalExcluded = { censored: 0, outOfRange: 0, missing: 0 }
  for (const m of metrics) {
    totalExcluded.censored += m.excluded.censored
    totalExcluded.outOfRange += m.excluded.outOfRange
    totalExcluded.missing += m.excluded.missing
  }
  return {
    datasetName,
    totalTests: rows.length,
    materials: metrics.map((m) => m.material),
    byMaterial: Object.fromEntries(
      metrics.map((m) => [
        m.material,
        {
          tests: m.tests,
          o2Conditions: m.o2Conditions,
          o2Min: m.o2Range !== null ? Math.min(...rows.filter((r) => r.material === m.material).map((r) => r.o2i).filter((v): v is number => v !== null)) : null,
          o2Max: m.o2Range !== null ? Math.max(...rows.filter((r) => r.material === m.material).map((r) => r.o2i).filter((v): v is number => v !== null)) : null,
          o2Range: m.o2Range,
          meanO2Consumed: m.o2ConsumedMean,
          o2ConsumedN: m.o2ConsumedN,
          meanCoProduced: m.coProducedMean,
          meanCo2Produced: m.co2ProducedMean,
          excludedCensored: m.excluded.censored,
          excludedOutOfRange: m.excluded.outOfRange,
          excludedMissing: m.excluded.missing,
        },
      ]),
    ),
    totalExcluded,
    hasCensoredReadings: totalExcluded.censored + totalExcluded.outOfRange > 0,
  }
}
