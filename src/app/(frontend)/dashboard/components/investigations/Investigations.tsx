'use client'

/**
 * The PSI catalogue and the habitat fire-safety ranking: one card per NASA PSI
 * combustion investigation, from psi.json (written by
 * src/scripts/psi-catalogue.ts from the cleaned tables), ranked by
 * transparent criteria whose weights the viewer can change.
 *
 * The tab is a set of widgets (Widget.tsx); which show, in what order and
 * which are collapsed is the layout in src/lib/widget-layout.ts, kept in the
 * viewer's browser when storage is available.
 */
import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { CRITERIA, DEFAULT_WEIGHTS, MAX_WEIGHT, rank, type PsiCatalogue, type PsiInvestigation, type Weights } from '@/lib/psi'
import { DEFAULT_LAYOUT, LAYOUT_KEY, layoutRows, widgetLayoutReducer, type WidgetId } from '@/lib/widget-layout'
import data from './psi.json'
import InvestigationCard from './InvestigationCard'
import { Assumptions, RankingList, WeightsPanel } from './Ranking'
import AiSummary from './AiSummary'
import MoonBaseCard, { MOON_RESULT } from './MoonBaseCard'
import Widget from './Widget'
import { linkProps, type WorkspaceLinks } from '../workspace/links'
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

/** The viewer's saved widget layout, or null (storage may be missing or hold anything; parseLayout makes it safe). */
function readSavedLayout(): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function Criteria({ inv }: { inv: PsiInvestigation }) {
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

/** Where an investigation's card leads in this dashboard (links.ts). */
export function CardLinks({ id, links }: { id: string; links: WorkspaceLinks }) {
  const items: { label: string; href: string; go: () => void; key: string }[] = []
  if (id === 'bass-ii') {
    items.push({ key: 'table', label: 'BASS-II charts and Data Table', href: links.visualizationHref(), go: links.openVisualization })
    items.push({ key: 'bass', label: 'BASS-II presets in the sandbox', href: links.groupHref('bass'), go: () => links.openGroup('bass') })
  }
  if (id === 'saffire-i-iii') items.push({ key: 'saffire', label: 'Saffire presets in the sandbox', href: links.groupHref('saffire'), go: () => links.openGroup('saffire') })
  if (id === 'cfi-g') items.push({ key: 'demo', label: 'Gas flame demo in the sandbox (visual demo, not NASA-scored)', href: links.demoHref(), go: links.openDemo })
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
      {items.map((l) => (
        <a key={l.key} {...linkProps(l.href, l.go)} data-card-goes={l.key} className="underline decoration-dotted underline-offset-2 hover:opacity-80" style={{ color: C.amber }}>
          {l.label}
        </a>
      ))}
    </div>
  )
}

export default function Investigations({ links }: { links?: WorkspaceLinks }) {
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS })
  const [layout, dispatch] = useReducer(widgetLayoutReducer, DEFAULT_LAYOUT)
  // The saved layout is read after the first render (the server has no storage),
  // and saved only once it has been read, so the default never overwrites it.
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  useEffect(() => {
    dispatch({ type: 'load', saved: readSavedLayout() })
    setLayoutLoaded(true)
  }, [])
  useEffect(() => {
    if (!layoutLoaded) return
    try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)) } catch { /* storage unavailable: the layout lasts this visit */ }
  }, [layout, layoutLoaded])

  // A link asked for one card (?card=flex, or "About these tests" in the sandbox): bring it into view.
  const [focused, setFocused] = useState<string | null>(null)
  const showCard = useCallback((id: string, smooth: boolean) => {
    dispatch({ type: 'reveal', id: 'cards' })
    setFocused(id)
    // After the cards widget has opened.
    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.getElementById(`psi-${id}`)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })))
  }, [])
  const cardNonce = links?.card?.nonce
  useEffect(() => {
    const id = links?.card?.id
    if (id) showCard(id, false)
    // Only a new request (a new nonce) moves the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardNonce])
  useEffect(() => setWeights(loadWeights()), [])
  const changeWeights = (w: Weights) => {
    setWeights(w)
    try { window.localStorage.setItem(WEIGHTS_KEY, JSON.stringify(w)) } catch { /* storage unavailable: weights last this visit */ }
  }

  const ranked = useMemo(() => rank(catalogue.investigations, weights), [weights])
  const isDefault = CRITERIA.every((c) => weights[c.key] === DEFAULT_WEIGHTS[c.key])
  const byId = useMemo(() => new Map(catalogue.investigations.map((i) => [i.id, i])), [])
  const ordered = ranked ? ranked.map((r) => ({ inv: byId.get(r.id)!, r })) : catalogue.investigations.map((inv) => ({ inv, r: null }))

  // What each widget holds, and the line its header shows while collapsed.
  const widgets: Partial<Record<WidgetId, { body: ReactNode; summary: ReactNode; highlight?: boolean }>> = {
    ranking: {
      summary: ranked ? ranked.slice(0, 3).map((r) => `${r.rank}. ${r.name} ${r.score}`).join(' · ') : 'every weight is 0',
      body: <RankingList ranked={ranked} onPick={(id) => showCard(id, true)} />,
    },
    weights: {
      summary: isDefault ? 'all weights 1 (equal)' : CRITERIA.map((c) => `${c.label} × ${weights[c.key]}`).join(' · '),
      body: <WeightsPanel weights={weights} onChange={changeWeights} />,
    },
    ai: {
      summary: 'a plain-language reading of the ranking at equal weights',
      body: (
        <div id="psi-overall" className="space-y-2">
          <AiSummary id="overall" auto title="the ranking" />
          {!isDefault && ranked && (
            <p className="text-[11px]" style={{ color: C.muted }}>
              The summary above is for equal weights. With your weights the top three are{' '}
              {ranked.slice(0, 3).map((r) => `${r.name} (${r.score})`).join(', ')}.
            </p>
          )}
        </div>
      ),
    },
    cards: {
      summary: `${catalogue.investigations.length} investigations`,
      body: (
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
              focused={focused === inv.id}
              footer={(
                <>
                  <Criteria inv={inv} />
                  {links && <CardLinks id={inv.id} links={links} />}
                  <AiSummary id={inv.id} title={inv.name} />
                </>
              )}
            />
          ))}
        </div>
      ),
    },
    moon: {
      summary: `${catalogue.moonBase.o2Pct}% O2, ${catalogue.moonBase.gravityG} g: the sample was fully consumed by step ${MOON_RESULT.consumedByStep}`,
      body: <MoonBaseCard moon={catalogue.moonBase} links={links} />,
      highlight: true,
    },
    assumptions: {
      summary: `${catalogue.reference.iss.label}, ${catalogue.reference.exploration.label.toLowerCase()}, ${catalogue.reference.ventilation.label.toLowerCase()}`,
      body: <Assumptions reference={catalogue.reference} />,
    },
  }
  const rows = layoutRows({ ...layout, hidden: [...layout.hidden, ...layout.order.filter((w) => !widgets[w])] })

  const widget = (id: WidgetId) => {
    const w = widgets[id]!
    return (
      <Widget
        key={id}
        id={id}
        collapsed={layout.collapsed.includes(id)}
        onToggleCollapsed={() => dispatch({ type: 'toggleCollapsed', id })}
        onClose={() => dispatch({ type: 'hide', id })}
        summary={w.summary}
        highlight={w.highlight}
      >
        {w.body}
      </Widget>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[17px] font-light" style={{ color: C.fg }}>NASA PSI combustion investigations</h2>
        <p className="mt-1 max-w-3xl text-[12px]" style={{ color: C.muted }}>
          {catalogue.investigations.length} investigations from NASA&apos;s Physical Sciences Informatics system, ranked for
          crew-habitat fire safety. Every number on a card is computed from the investigation&apos;s cleaned table; where a
          table has no outcomes, the card says so.
        </p>
      </div>

      <div id="psi-widgets" className="space-y-4">
        {rows.map((row) =>
          row.length === 2 ? (
            <div key={row.join('+')} className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-2">
              {row.map(widget)}
            </div>
          ) : (
            widget(row[0])
          ),
        )}
        {rows.length === 0 && (
          <p className="text-[12px]" style={{ color: C.muted }}>Every widget is closed.</p>
        )}
      </div>
    </div>
  )
}
