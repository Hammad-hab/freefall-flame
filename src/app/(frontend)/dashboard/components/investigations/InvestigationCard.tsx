'use client'

/**
 * One card of the PSI catalogue: what was burned, the conditions, the number
 * of tests, the outcomes and facts computed from the cleaned table, and the
 * sources (every card cites its PSI id). All values come from psi.json.
 */
import type { ReactNode } from 'react'
import { testsLabel, type PsiFact, type PsiInvestigation } from '@/lib/psi'
import { C, panelCls, panelStyle } from '../ui/chart-theme'
import { StatusBadge } from './Simulated'

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2))))

function Fact({ f }: { f: PsiFact }) {
  let body: ReactNode
  if (f.kind === 'count') body = f.items.map((i) => `${i.value} ${i.count}`).join(' · ')
  else if (f.kind === 'range') body = `${fmt(f.min)}–${fmt(f.max)} ${f.unit} (${f.n} values)`
  else if (f.kind === 'sum') body = `${fmt(f.value)} (over ${f.n} rows)`
  else body = f.text
  return (
    <li className="leading-5">
      <span style={{ color: C.muted }}>{f.label}: </span>
      <span className="tabular-nums" style={{ color: C.fg }}>{body}</span>
    </li>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 leading-5">
      <span style={{ color: C.muted }}>{label}</span>
      <span className="min-w-0 break-words tabular-nums" style={{ color: C.fg }}>{children}</span>
    </div>
  )
}

export default function InvestigationCard({
  inv,
  header,
  footer,
  focused = false,
  detail = false,
}: {
  inv: PsiInvestigation
  /** Highlighted because a link asked for this card. */
  focused?: boolean
  /** Extra content beside the title (the ranking adds its score here). */
  header?: ReactNode
  /** Extra content at the end (the ranking's criteria, the AI summary, links). */
  footer?: ReactNode
  /** The full card inside the Details side panel (CardDrawer.tsx): no panel of its own, its own ids. */
  detail?: boolean
}) {
  return (
    <article
      id={detail ? `psi-detail-${inv.id}` : `psi-${inv.id}`}
      data-psi={detail ? undefined : inv.id}
      data-psi-detail={detail ? inv.id : undefined}
      data-focused={focused || undefined}
      className={detail ? 'flex flex-col gap-3' : `${panelCls} flex scroll-mt-4 flex-col gap-3`}
      style={detail ? undefined : focused ? { ...panelStyle, borderColor: C.amber } : panelStyle}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={detail ? `psi-detail-${inv.id}-title` : undefined} className="text-[15px] font-medium leading-tight" style={{ color: C.fg }}>{inv.name}</h3>
          <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
            {inv.psiId} · {inv.fuelPhase} · {inv.hardware}
          </p>
        </div>
        {header}
      </header>

      <div className="space-y-0.5 text-[11px]">
        <Row label="What was burned">{inv.fuels}</Row>
        {/* "13.6-22.2" -> "13.6-22.2 %"; "21 (air)" -> "21 % (air)". */}
        <Row label="Oxygen">{inv.o2Pct === 'not in table' ? 'not in the table' : inv.o2Pct.replace(/^([\d.]+(?:-[\d.]+)?)/, '$1 %')}</Row>
        <Row label="Pressure">{inv.pressure === 'not in table' ? 'not in the table' : inv.pressure}</Row>
        <Row label="Flow">{inv.flowCmS === 'not in table' ? 'not in the table' : /\d/.test(inv.flowCmS) && !/mg/.test(inv.flowCmS) ? `${inv.flowCmS} cm/s` : inv.flowCmS}</Row>
        <Row label="Tests">{testsLabel(inv)}</Row>
        <Row label="Outcomes">{inv.outcomeRecorded}</Row>
        <Row label="Fire-safety theme">{inv.safetyTheme}</Row>
      </div>

      <div className="text-[11px]" data-card-simulation>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>What we simulated</span>
          <StatusBadge sim={inv.simulation} />
        </div>
        <p className="leading-5" style={{ color: C.fg }}>{inv.simulation.reason}</p>
      </div>

      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>From the cleaned table</div>
        <ul className="space-y-0.5 text-[11px]">
          {inv.facts.map((f, k) => <Fact key={k} f={f} />)}
          <li className="leading-5" style={{ color: C.muted }}>
            {inv.flaggedRows} of {inv.rows} rows carry a flag (a problem noted while cleaning).
          </li>
        </ul>
      </div>

      <div className="text-[11px]">
        <div className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>Sources</div>
        <ul className="space-y-0.5" data-sources>
          {inv.sources.map((s, k) =>
            s.kind === 'psi' ? (
              <li key={k} style={{ color: C.fg }}>
                NASA PSI table {s.psiId} <span style={{ color: C.muted }}>(cleaned: {s.table})</span>
              </li>
            ) : (
              <li key={k}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2" style={{ color: C.amber }}>
                  {s.title}
                </a>{' '}
                <span style={{ color: C.muted }}>(NTRS {s.ntrsId})</span>
              </li>
            ),
          )}
        </ul>
      </div>

      {footer}
    </article>
  )
}
