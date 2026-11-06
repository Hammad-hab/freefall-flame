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
}

export interface PsiCatalogue {
  about: string
  catalogueSha256: string
  investigations: PsiInvestigation[]
}
