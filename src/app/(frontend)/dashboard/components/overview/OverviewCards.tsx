'use client'

/**
 * The Overview's judge-facing cards (feat/ui-visuals): tests per material as
 * bars, the sandbox's scorecard, and "About this dataset", a closed section
 * holding the developer-style cards (columns, preview, investigators) so
 * nothing is lost. All numbers come from the dataset's rows and
 * sandbox/scorecard.json.
 */
import type { ReactNode } from 'react'
import type { ParsedRow } from '@/lib/combustion'
import scorecard from '../sandbox/scorecard.json'
import { linkProps, type WorkspaceLinks } from '../workspace/links'
import { C, panelCls, panelStyle } from '../ui/chart-theme'

/** Tests per material, most first (ties by name). */
export function materialCounts(rows: ParsedRow[]): [string, number][] {
  const m = new Map<string, number>()
  for (const r of rows) if (r.material) m.set(r.material, (m.get(r.material) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export function MaterialsCard({ rows }: { rows: ParsedRow[] }) {
  const counts = materialCounts(rows)
  const max = Math.max(1, ...counts.map(([, n]) => n))
  return (
    <section id="overview-materials" className={panelCls} style={panelStyle}>
      <h2 className="text-[15px] font-medium" style={{ color: C.fg }}>Tests per material</h2>
      <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>What NASA burned in the {rows.length} tests of this dataset</p>
      {counts.length === 0 ? (
        <p className="mt-3 text-[12px]" style={{ color: C.muted }}>This dataset has no material column.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-[12px]">
          {counts.map(([m, n]) => (
            <li key={m} data-material={m} className="grid grid-cols-[minmax(0,8rem)_1fr_2.5rem] items-center gap-3">
              <span className="truncate" style={{ color: C.fg }} title={m}>{m}</span>
              <span className="h-2 overflow-hidden rounded-full" style={{ background: C.chip }}>
                <span className="block h-full rounded-full" style={{ width: `${(100 * n) / max}%`, background: C.amber }} />
              </span>
              <span className="text-right tabular-nums" style={{ color: C.fg }}>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ScorecardCard({ total, links }: { total: number; links?: WorkspaceLinks }) {
  const { matched, scored, matchedTests } = scorecard
  return (
    <section id="overview-scorecard" className={panelCls} style={panelStyle}>
      <h2 className="text-[15px] font-medium" style={{ color: C.fg }}>Our simulator against NASA</h2>
      <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>Each scorable BASS-II test run to the end in the sandbox</p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-[30px] font-light leading-none tabular-nums" style={{ color: C.accentText }}>{matched}</span>
        <span className="text-[13px]" style={{ color: C.fg }}>of {scored} scored tests match NASA</span>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full" style={{ background: C.chip }} aria-hidden="true">
        <span className="block h-full" style={{ width: `${(100 * matched) / scored}%`, background: C.green }} />
      </div>
      <dl className="mt-3 space-y-1 text-[11px] leading-5">
        <Row label="Match">{matchedTests.join(', ')}</Row>
        <Row label="No match">{scored - matched} tests</Row>
        <Row label="Not scored">{total - scored} tests: NASA states no outcome for them</Row>
      </dl>
      {links && (
        <a
          {...linkProps(links.groupHref('bass'), () => links.openGroup('bass'))}
          className="mt-3 inline-block text-[11px] underline decoration-dotted underline-offset-2 hover:opacity-80"
          style={{ color: C.accentText }}
        >
          Run them in the sandbox
        </a>
      )}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <dt style={{ color: C.muted }}>{label}</dt>
      <dd className="tabular-nums" style={{ color: C.fg }}>{children}</dd>
    </div>
  )
}

/** The developer-style cards, kept but folded away (closed by default). */
export function AboutDataset({ children }: { children: ReactNode }) {
  return (
    <details id="about-dataset" className="group rounded-[22px] border px-5 py-4" style={{ borderColor: C.line, background: C.ink2 }}>
      <summary className="cursor-pointer select-none text-[13px] font-medium" style={{ color: C.fg }}>
        About this dataset
        <span className="ml-2 text-[11px] font-normal" style={{ color: C.muted }}>columns, a preview of the rows, tests by investigator</span>
      </summary>
      <div className="mt-4 space-y-6">{children}</div>
    </details>
  )
}
