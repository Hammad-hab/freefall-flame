'use client'

/**
 * One investigation, compact: name, score and rank, its simulation status,
 * and three key facts (what burned, oxygen, tests). "Details" opens the full
 * card (InvestigationCard) in the side panel (CardDrawer). All values come
 * from psi.json.
 */
import type { ReactNode } from 'react'
import type { PsiInvestigation, Ranked } from '@/lib/psi'
import { Row } from './InvestigationCard'
import { C, panelCls, panelStyle } from '../ui/chart-theme'

/** "13.6-22.2" -> "13.6-22.2 %"; "21 (air)" -> "21 % (air)"; "not in table" -> "not in the table". */
export const oxygenText = (o2: string) => (o2 === 'not in table' ? 'not in the table' : o2.replace(/^([\d.]+(?:-[\d.]+)?)/, '$1 %'))

export const testsShort = (inv: PsiInvestigation) =>
  inv.tests > 0 ? `${inv.tests} (${inv.granularity})` : `no single tests; ${inv.rows} rows (${inv.granularity})`

export default function CompactCard({
  inv,
  r,
  focused,
  badge,
  onDetails,
}: {
  inv: PsiInvestigation
  r: Ranked | null
  focused: boolean
  /** The simulation status badge (what we simulated). */
  badge?: ReactNode
  onDetails: (opener: HTMLElement) => void
}) {
  return (
    <article
      id={`psi-${inv.id}`}
      data-psi={inv.id}
      data-focused={focused || undefined}
      className={`${panelCls} flex scroll-mt-16 flex-col gap-2 !p-4`}
      style={focused ? { ...panelStyle, borderColor: C.amber } : panelStyle}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[14px] font-medium leading-tight" style={{ color: C.fg }}>{inv.name}</h4>
          <p className="mt-0.5 text-[10px]" style={{ color: C.muted }}>{inv.psiId} · {inv.fuelPhase}</p>
        </div>
        {r && (
          <span className="shrink-0 text-right">
            <span className="block text-[18px] font-light leading-none tabular-nums" style={{ color: C.amber }} data-card-score>{r.score}</span>
            <span className="block text-[10px]" style={{ color: C.muted }} data-card-rank>rank {r.rank}</span>
          </span>
        )}
      </header>
      {badge}
      <div className="space-y-0.5 text-[11px]">
        <Row label="What was burned"><span className="block truncate" title={inv.fuels}>{inv.fuels}</span></Row>
        <Row label="Oxygen">{oxygenText(inv.o2Pct)}</Row>
        <Row label="Tests">{testsShort(inv)}</Row>
      </div>
      <button
        type="button"
        data-details={inv.id}
        aria-haspopup="dialog"
        onClick={(e) => onDetails(e.currentTarget)}
        className="mt-auto self-start rounded-full border px-3 py-1 text-[11px] transition-colors hover:brightness-110"
        style={{ borderColor: C.line, background: C.surface, color: C.fg }}
      >
        Details<span className="sr-only">: {inv.name}</span>
      </button>
    </article>
  )
}
