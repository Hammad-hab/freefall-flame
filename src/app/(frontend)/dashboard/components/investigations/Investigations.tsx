'use client'

/**
 * The PSI catalogue and the habitat fire-safety ranking: one card per NASA PSI
 * combustion investigation, from psi.json (written by
 * src/scripts/psi-catalogue.ts from the cleaned tables), ranked by
 * transparent criteria whose weights the viewer can change.
 */
import { useEffect, useMemo, useState } from 'react'
import { CRITERIA, DEFAULT_WEIGHTS, MAX_WEIGHT, rank, type PsiCatalogue, type PsiInvestigation, type Weights } from '@/lib/psi'
import data from './psi.json'
import InvestigationCard from './InvestigationCard'
import { Assumptions, RankingList, WeightsPanel } from './Ranking'
import AiSummary from './AiSummary'
import { C } from '../ui/chart-theme'

const catalogue = data as PsiCatalogue
const WEIGHTS_KEY = 'psi-weights-v1'

/** The viewer's own weights, kept in this browser only (a convenience; may be unavailable). */
function loadWeights(): Weights {
  try {
    const saved = JSON.parse(window.localStorage.getItem(WEIGHTS_KEY) ?? 'null') as Partial<Weights> | null
    if (!saved) return { ...DEFAULT_WEIGHTS }
    const w = { ...DEFAULT_WEIGHTS }
    for (const c of CRITERIA) {
      const v = saved[c.key]
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_WEIGHT) w[c.key] = v
    }
    return w
  } catch {
    return { ...DEFAULT_WEIGHTS }
  }
}

function Criteria({ inv }: { inv: PsiInvestigation }) {
  return (
    <div data-criteria>
      <div className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>Habitat relevance</div>
      <ul className="space-y-1 text-[11px]">
        {CRITERIA.map((c) => {
          const s = inv.scores[c.key]
          return (
            <li key={c.key} className="grid grid-cols-[1.5rem_1fr] gap-2 leading-5" data-criterion={c.key}>
              <span className="tabular-nums" style={{ color: s.score === 2 ? C.green : s.score === 1 ? C.amber : C.muted }}>{s.score}/2</span>
              <span>
                <span style={{ color: C.fg }}>{c.label}</span>
                {'judgement' in c && c.judgement && <span style={{ color: C.muted }}> (our judgement)</span>}
                <span style={{ color: C.muted }}>: {s.reason}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function Investigations() {
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS })
  useEffect(() => setWeights(loadWeights()), [])
  const changeWeights = (w: Weights) => {
    setWeights(w)
    try { window.localStorage.setItem(WEIGHTS_KEY, JSON.stringify(w)) } catch { /* storage unavailable: weights last this visit */ }
  }

  const ranked = useMemo(() => rank(catalogue.investigations, weights), [weights])
  const isDefault = CRITERIA.every((c) => weights[c.key] === DEFAULT_WEIGHTS[c.key])
  const byId = useMemo(() => new Map(catalogue.investigations.map((i) => [i.id, i])), [])
  const ordered = ranked ? ranked.map((r) => ({ inv: byId.get(r.id)!, r })) : catalogue.investigations.map((inv) => ({ inv, r: null }))

  const pick = (id: string) => document.getElementById(`psi-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[17px] font-light" style={{ color: C.fg }}>NASA PSI combustion investigations</h2>
        <p className="mt-1 max-w-3xl text-[12px]" style={{ color: C.muted }}>
          {catalogue.investigations.length} investigations from NASA&apos;s Physical Sciences Informatics system, ranked for
          crew-habitat fire safety. Every number on a card is computed from the investigation&apos;s cleaned table; where a
          table has no outcomes, the card says so.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <RankingList ranked={ranked} onPick={pick} />
          <div id="psi-overall" className="space-y-2">
            <AiSummary id="overall" auto title="the ranking" />
            {!isDefault && ranked && (
              <p className="text-[11px]" style={{ color: C.muted }}>
                The summary above is for equal weights. With your weights the top three are{' '}
                {ranked.slice(0, 3).map((r) => `${r.name} (${r.score})`).join(', ')}.
              </p>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <WeightsPanel weights={weights} onChange={changeWeights} />
          <Assumptions reference={catalogue.reference} />
        </div>
      </div>

      <div id="psi-cards" className="grid grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
        {ordered.map(({ inv, r }) => (
          <InvestigationCard
            key={inv.id}
            inv={inv}
            header={r && (
              <span className="shrink-0 text-right">
                <span className="block text-[18px] font-light tabular-nums" style={{ color: C.amber }} data-card-score>{r.score}</span>
                <span className="block text-[10px]" style={{ color: C.muted }}>rank {r.rank}</span>
              </span>
            )}
            footer={(
              <>
                <Criteria inv={inv} />
                <AiSummary id={inv.id} title={inv.name} />
              </>
            )}
          />
        ))}
      </div>
    </div>
  )
}
