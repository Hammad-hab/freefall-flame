'use client'

/**
 * The habitat-relevance ranking: the weights (one slider per criterion), the
 * reference values behind the criteria (stated assumptions, with sources), and
 * the ranked list. Scores and their reasons come from psi.json; only the
 * weighting happens here (rank() in src/lib/psi.ts).
 */
import { CRITERIA, MAX_WEIGHT, DEFAULT_WEIGHTS, rankLabel, type HabitatReference, type Ranked, type Weights } from '@/lib/psi'
import { C } from '../ui/chart-theme'
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css'

/** "1." for a rank of its own, "2=" for a tie. */
const rankLabelText = (r: Ranked, ranked: Ranked[]) => {
  const l = rankLabel(r, ranked)
  return l.endsWith('=') ? l : `${l}.`
}

// Each of these sits inside a Widget (Widget.tsx), which draws the panel and the title.

export function WeightsPanel({ weights, onChange }: { weights: Weights; onChange: (w: Weights) => void }) {
  const isDefault = CRITERIA.every((c) => weights[c.key] === DEFAULT_WEIGHTS[c.key])
  return (
    <div id="psi-weights">
      <div className="flex items-start justify-between gap-3">
        <div className="py-1 leading-normal" style={{ color: C.muted, fontSize: 14 }}>
          <Latex>
            {String.raw`$\displaystyle \text{Score} = \frac{\sum_i w_i c_i}{2 \sum_i w_i} \times 100$`}
          </Latex>
          <br/>
           Each criterion is 0, 1 or 2.
        </div>
        <button
          onClick={() => onChange({ ...DEFAULT_WEIGHTS })}
          disabled={isDefault}
          className="shrink-0 rounded-full border px-3 py-1 text-[11px] transition-colors hover:bg-line/50 disabled:opacity-40"
          style={{ borderColor: C.line, color: C.muted }}
        >
          Reset weights
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {CRITERIA.map((c) => (
          <label key={c.key} className="block text-[11px]">
            <span className="flex items-baseline justify-between gap-2">
              <span style={{ color: C.fg }}>
                {c.label}
                {'judgement' in c && c.judgement && (
                  <span className="ml-1.5 rounded px-1 py-0.5 text-[10px]" style={{ background: C.chip2, color: C.muted }}>our judgement</span>
                )}
              </span>
              <span className="tabular-nums" style={{ color: C.accentText }} data-weight-value={c.key}>× {weights[c.key]}</span>
            </span>
            <input
              type="range"
              min={0}
              max={MAX_WEIGHT}
              step={1}
              value={weights[c.key]}
              onChange={(e) => onChange({ ...weights, [c.key]: Number(e.target.value) })}
              aria-label={`Weight: ${c.label}`}
              data-weight={c.key}
              className="mt-1 w-full accent-[var(--c-accent)]"
            />
            <span className="block text-[10px] leading-4" style={{ color: C.muted }}>{c.help}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function Assumptions({ reference }: { reference: HabitatReference }) {
  const r = reference
  return (
    <div id="psi-assumptions">
      <p className="text-[11px]" style={{ color: C.muted }}>
        The criteria compare each table with these habitat values. They are not NASA PSI data.
      </p>
      <ul className="mt-2 space-y-2 text-[11px] leading-5">
        <li><span style={{ color: C.fg }}>{r.iss.label}:</span> <span style={{ color: C.muted }}>{r.iss.text}. Counted as covered when the {r.iss.rule}.</span></li>
        <li>
          <span style={{ color: C.fg }}>{r.exploration.label}:</span>{' '}
          <span style={{ color: C.muted }}>{r.exploration.text} Source: {r.exploration.source}. Counted as reached when {r.exploration.rule}.</span>
        </li>
        <li>
          <span style={{ color: C.fg }}>{r.ventilation.label}:</span>{' '}
          <span style={{ color: C.muted }}>{r.ventilation.text}. Source: {r.ventilation.source}.</span>
        </li>
      </ul>
    </div>
  )
}

export function RankingList({ ranked, onPick }: { ranked: Ranked[] | null; onPick: (id: string) => void }) {
  return (
    <div id="psi-ranking">
      {ranked === null ? (
        <p className="text-[11px]" style={{ color: C.accentText }}>Every weight is 0, so there is nothing to rank by. Raise at least one weight.</p>
      ) : (
        <ol className="space-y-1 text-[12px]">
          {ranked.map((r) => (
            <li key={r.id} data-rank-id={r.id} className="flex items-center gap-2">
              {/* A tie reads "2=" (both), as in the AI facts and the plain summary. */}
              <span className="w-7 shrink-0 text-right tabular-nums" style={{ color: C.muted }} data-rank-label>{rankLabelText(r, ranked)}</span>
              <button onClick={() => onPick(r.id)} className="min-w-0 flex-1 truncate text-left hover:underline" style={{ color: C.fg }}>
                {r.name}
              </button>
              <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full" style={{ background: C.chip }}>
                <span className="block h-full rounded-full" style={{ width: `${r.score}%`, background: C.amber }} />
              </span>
              <span className="w-8 shrink-0 text-right tabular-nums" style={{ color: C.fg }} data-score>{r.score}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[10px] leading-4" style={{ color: C.muted }}>
        Relevance to crew-habitat fire safety, not fire risk: a high score means the data speaks more directly to
        habitat conditions, not that a material is dangerous.
      </p>
    </div>
  )
}
