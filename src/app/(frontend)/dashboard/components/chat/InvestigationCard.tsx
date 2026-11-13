'use client'

import { makeAssistantToolUI } from '@assistant-ui/react'
import { cn } from '@/lib/utils'

// Mirror of the backend's toSummary() return shape.
interface InvestigationSummary {
  id: string
  name: string
  psiId: string
  tests: number
  safetyTheme: string
  score: number | null
  rank: number | null
}

// Mirror of the backend's toDetail() return shape.
interface InvestigationDetail {
  id: string
  name: string
  psiId: string
  fuelPhase: string
  hardware: string
  tests: number
  granularity: string
  rows: number
  flaggedRows: number
  fuels: string
  o2Pct: string
  pressure: string
  flowCmS: string
  outcomeRecorded: string
  safetyTheme: string
  simulation: { status: string; label: string; reason: string }
  facts: { kind: string; label: string }[]
  sources: { kind: string; psiId?: string; table?: string; title?: string; ntrsId?: string; url?: string }[]
  scores: Record<string, { score: number; reason: string }>
  score: number | null
  rank: number | null
  error?: string
}

const card = 'rounded-lg border border-line bg-ink-2 p-3 text-[12px] mb-5'

export const InvestigationListUI = makeAssistantToolUI<
  Record<string, never>,
  { investigations: InvestigationSummary[] }
>({
  toolName: 'listInvestigations',
  render: ({ result, status }) => {
    if (status.type === 'running') {
      return <div className={card}>Loading investigations…</div>
    }
    const items = result?.investigations ?? []
    if (items.length === 0) return <div className={card}>No investigations returned.</div>
    return (
      <div className={card}>
        <div className="mb-2 text-[13px] font-semibold text-fg">
          NASA PSI combustion investigations ({items.length})
        </div>
        <ul className="space-y-1.5">
          {items.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="font-medium text-fg">{inv.name}</span>
                <span className="ml-1.5 text-muted">{inv.psiId}</span>
                <span className="ml-1.5 text-muted">· {inv.tests} tests</span>
              </span>
              <span className="shrink-0 text-muted">
                {inv.rank != null ? `rank ${inv.rank}` : ''}{' '}
                {inv.score != null ? `· ${inv.score}/100` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  },
})

export const InvestigationCardUI = makeAssistantToolUI<
  { id: string },
  InvestigationDetail
>({
  toolName: 'getInvestigation',
  render: ({ args, result, status }) => {
    if (status.type === 'running') {
      return (
        <div className={card}>
          Loading {args?.id ?? 'investigation'}…
        </div>
      )
    }
    if (!result) return null
    if (result.error) {
      return <div className={cn(card, 'text-red-300')}>{result.error}</div>
    }

    const rankLabel =
      result.rank != null ? (result.score != null ? `#${result.rank} · ${result.score}/100` : `#${result.rank}`) : ''

    return (
      <div className={card}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-fg">{result.name}</div>
            <div className="text-muted">
              {result.psiId} · {result.fuelPhase} fuels · {result.hardware}
            </div>
          </div>
          {rankLabel && (
            <span className="shrink-0 rounded-full bg-flame-amber/20 px-2 py-0.5 text-[11px] font-medium text-flame-amber">
              {rankLabel}
            </span>
          )}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-muted">
          <span>Fuels: <span className="text-fg">{result.fuels}</span></span>
          <span>O₂: <span className="text-fg">{result.o2Pct}%</span></span>
          <span>Pressure: <span className="text-fg">{result.pressure}</span></span>
          <span>Flow: <span className="text-fg">{result.flowCmS} cm/s</span></span>
          <span>Tests: <span className="text-fg">{result.tests} ({result.granularity})</span></span>
          <span>Outcomes: <span className="text-fg">{result.outcomeRecorded}</span></span>
        </div>

        <div className="mt-2 text-muted">
          Theme: <span className="text-fg">{result.safetyTheme}</span>
        </div>

        {result.simulation && (
          <div className="mt-2 rounded border border-line bg-ink px-2 py-1.5">
            <span className="font-medium text-fg">{result.simulation.label}</span>
            <span className="ml-1.5 text-muted">{result.simulation.reason}</span>
          </div>
        )}

        {result.scores && (
          <div className="mt-2 space-y-0.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Habitat relevance
            </div>
            {Object.entries(result.scores).map(([key, v]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-muted">{key}</span>
                <span className="text-fg">{v.score}/2</span>
              </div>
            ))}
          </div>
        )}

        {result.facts?.length > 0 && (
          <div className="mt-2 space-y-0.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Facts
            </div>
            {result.facts.map((f, i) => (
              <div key={i} className="text-muted">
                {f.label}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  },
})
