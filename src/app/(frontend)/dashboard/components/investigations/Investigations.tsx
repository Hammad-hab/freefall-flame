'use client'

/**
 * The PSI catalogue: one card per NASA PSI combustion investigation, from
 * psi.json (written by src/scripts/psi-catalogue.ts from the cleaned tables).
 */
import type { PsiCatalogue } from '@/lib/psi'
import data from './psi.json'
import InvestigationCard from './InvestigationCard'
import { C } from '../ui/chart-theme'

const catalogue = data as PsiCatalogue

export default function Investigations() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[17px] font-light" style={{ color: C.fg }}>NASA PSI combustion investigations</h2>
        <p className="mt-1 max-w-3xl text-[12px]" style={{ color: C.muted }}>
          {catalogue.investigations.length} investigations from NASA&apos;s Physical Sciences Informatics system.
          Every number on a card is computed from the investigation&apos;s cleaned table; where a table has no
          outcomes, the card says so.
        </p>
      </div>
      <div id="psi-cards" className="grid grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
        {catalogue.investigations.map((inv) => <InvestigationCard key={inv.id} inv={inv} />)}
      </div>
    </div>
  )
}
