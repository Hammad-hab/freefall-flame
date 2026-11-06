/**
 * The PSI catalogue: NASA's 14 Physical Sciences Informatics combustion
 * investigations, one card each. The data is a checked-in file,
 * src/app/(frontend)/dashboard/components/investigations/psi.json, written by
 * src/scripts/psi-catalogue.ts from the cleaned tables in data/psi/ (no
 * database). This module holds its types. No React, no server code.
 */

/** A fact computed from an investigation's cleaned table. */
export type PsiFact =
  | { kind: 'count'; label: string; total: number; items: { value: string; count: number }[] }
  | { kind: 'range'; label: string; unit: string; min: number; max: number; n: number }
  | { kind: 'sum'; label: string; value: number; n: number }
  | { kind: 'note'; label: string; text: string }

export type PsiSource =
  | { kind: 'psi'; psiId: string; table: string }
  | { kind: 'paper'; title: string; ntrsId: string; url: string }

export interface PsiInvestigation {
  /** URL-safe id, e.g. "bass-ii". */
  id: string
  name: string
  psiId: string
  fuelPhase: string
  hardware: string
  /** Tests as the catalogue counts them (0 for summaries and per-day tables). */
  tests: number
  granularity: string
  /** Rows in the cleaned table. */
  rows: number
  /** Rows whose `flags` column lists a problem. */
  flaggedRows: number
  fuels: string
  o2Pct: string
  pressure: string
  flowCmS: string
  outcomeRecorded: string
  safetyTheme: string
  simulator: string
  cleanedFile: string
  facts: PsiFact[]
  sources: PsiSource[]
  /** Habitat-relevance criteria, each 0-2 with its reason (see CRITERIA). */
  scores: PsiScores
}

export interface PsiCatalogue {
  about: string
  catalogueSha256: string
  /** The habitat reference values the scores were computed against (HABITAT_REFERENCE). */
  reference: HabitatReference
  investigations: PsiInvestigation[]
  /** What the tables hold near the Moon-base scenario's oxygen (an extrapolation card). */
  moonBase: MoonBase
}

/** The Moon-base scenario card: 34% O2 (the top of the exploration range) and 0.17 g. */
export interface MoonBase {
  o2Pct: number
  gravityG: number
  /** The highest oxygen in any solid-material test (BASS-II), and Saffire's highest. */
  solidMaxO2Pct: number
  saffireMaxO2Pct: number
  /** Tables with tests at 30% O2 or more. */
  near: {
    investigation: string
    what: string
    unit: string
    atLeast30: number
    /** Of those, at 34% O2 (within 0.5 points). */
    at34: number
    /** Of those, at 0.7 atm or less (null: pressure not in the table, or about 1 atm). */
    lowPressure: number | null
    outcomes: { value: string; count: number }[] | null
  }[]
}

/* ------------------------------------------------------------------ */
/* Habitat relevance ranking                                          */
/* ------------------------------------------------------------------ */

/**
 * Reference values the ranking compares against. They are stated
 * assumptions, not NASA PSI data, and the dashboard shows them with their
 * sources.
 */
export interface HabitatReference {
  iss: { label: string; text: string; rule: string; o2Pct: number[]; pressureAtm: number[] }
  exploration: { label: string; text: string; source: string; rule: string; minO2Pct: number; maxPressureAtm: number }
  ventilation: { label: string; text: string; source: string; cmS: number[] }
}

export const HABITAT_REFERENCE: HabitatReference = {
  iss: {
    label: 'ISS cabin',
    text: 'about 21% O2 at 1 atm (14.7 psia)',
    /** Criterion b: a table covers ISS air if its ranges overlap these bands. */
    rule: 'oxygen range overlaps 20.5-22.5% and pressure range overlaps 0.95-1.05 atm',
    o2Pct: [20.5, 22.5],
    pressureAtm: [0.95, 1.05],
  },
  exploration: {
    label: 'Exploration atmosphere',
    text: '32-34% O2 at 8.0-8.2 psia (0.54-0.56 atm). The Exploration Atmospheres Working Group recommended 8.0 psia / 32%; 8.2 psia / 34% is a proposed refinement.',
    source: 'Norcross et al. 2013, "Effects of the 8 psia / 32% O2 Atmosphere on the Human in the Spaceflight Environment", NTRS 20130013505',
    rule: 'the table goes to at least 30% O2 or down to at most 0.7 atm',
    /** Criterion b counts a table as reaching it at this oxygen or more ... */
    minO2Pct: 30,
    /** ... or at this pressure or less. */
    maxPressureAtm: 0.7,
  },
  ventilation: {
    label: 'Cabin ventilation',
    text: 'typically about 7.6-20 cm/s (15-40 ft/min); the lower figure is the classic station minimum',
    source: 'SAE 932191',
    cmS: [7.6, 20],
  },
}

export const CRITERIA = [
  { key: 'materials', label: 'Habitat materials', help: '2: spacecraft solids (PMMA, SIBAL, Nomex, silicone, Kapton, Teflon, Ultem, Pyrell, lampwick); 1: gas flames emulating solids; 0: model fuels only' },
  { key: 'atmosphere', label: 'Habitat atmosphere', help: '1 point for covering ISS air, 1 for reaching the exploration atmosphere (at least 30% O2 or at most 0.7 atm)' },
  { key: 'airflow', label: 'Cabin airflow', help: '2: overlaps cabin ventilation (7.6-20 cm/s); 1: still or slow air only (the ventilation-failure case); 0: burner flow only, or not given' },
  { key: 'richness', label: 'Data richness', help: '1 point for 100 tests or more, 1 for outcomes recorded in the table' },
  { key: 'decision', label: 'Informs a fire-safety decision', help: 'our judgement: 2 direct (prevention, detection or suppression at spacecraft conditions), 1 indirect, 0 fundamental science', judgement: true },
] as const

export type CriterionKey = (typeof CRITERIA)[number]['key']
export interface CriterionScore { score: 0 | 1 | 2; reason: string }
export type PsiScores = Record<CriterionKey, CriterionScore>
export type Weights = Record<CriterionKey, number>

export const DEFAULT_WEIGHTS: Weights = { materials: 1, atmosphere: 1, airflow: 1, richness: 1, decision: 1 }
export const MAX_WEIGHT = 3

export interface Ranked { id: string; name: string; score: number; rank: number }

/**
 * Score = sum(weight x criterion) / (2 x sum(weights)) x 100, so 0-100.
 * Sorted by score, then name; equal scores share a rank. Null if every
 * weight is 0 (nothing to rank by).
 */
export function rank(items: { id: string; name: string; scores: PsiScores }[], weights: Weights): Ranked[] | null {
  const total = CRITERIA.reduce((s, c) => s + Math.max(0, weights[c.key] ?? 0), 0)
  if (total === 0) return null
  const scored = items.map((i) => ({
    id: i.id,
    name: i.name,
    score: Math.round((100 * CRITERIA.reduce((s, c) => s + Math.max(0, weights[c.key] ?? 0) * i.scores[c.key].score, 0)) / (2 * total)),
  }))
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  // Rank = 1 + how many score strictly higher (so ties share a rank: 1, 2, 2, 4).
  return scored.map((s) => ({ ...s, rank: 1 + scored.filter((o) => o.score > s.score).length }))
}
