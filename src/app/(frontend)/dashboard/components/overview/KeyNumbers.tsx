'use client'

/**
 * Fire-safety numbers for the Overview, all from real data: tests per
 * material and NASA's stated outcomes (from the dataset's rows), the
 * sandbox's honest scorecard (sandbox/scorecard.json) and the top-ranked PSI
 * investigation (investigations/psi.json at equal weights). Replaces the
 * template "Sources" card ("Encryption ensures supplier data...").
 */
import type { ParsedRow } from '@/lib/combustion'
import { DEFAULT_WEIGHTS, rank, type PsiCatalogue } from '@/lib/psi'
import scorecard from '../sandbox/scorecard.json'
import psi from '../investigations/psi.json'
import { OUTCOME_CODES } from '../visualization/chartData'
import { linkProps, type WorkspaceLinks } from '../workspace/links'

const top = rank((psi as PsiCatalogue).investigations, DEFAULT_WEIGHTS)![0]

function count<T>(items: T[], key: (t: T) => string | null): [string, number][] {
  const m = new Map<string, number>()
  for (const i of items) {
    const k = key(i)
    if (k !== null) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export default function KeyNumbers({ rows, links }: { rows: ParsedRow[]; links?: WorkspaceLinks }) {
  const materials = count(rows, (r) => r.material)
  const outcomes = count(rows, (r) => r.outcome)
  // In the order of NASA's codes (as the outcome chart lists them), not by count.
  const order = (c: string) => { const i = OUTCOME_CODES.findIndex((o) => o.code === c); return i < 0 ? 99 : i }
  const stated = outcomes.filter(([c]) => c !== 'not_stated').sort((a, b) => order(a[0]) - order(b[0]))
  const statedTotal = stated.reduce((s, [, n]) => s + n, 0)
  const label = (code: string) => OUTCOME_CODES.find((o) => o.code === code)?.label.toLowerCase() ?? code.replace(/_/g, ' ')

  return (
    <div id="key-numbers" className="relative overflow-hidden rounded-[22px] bg-flame-amber p-5 text-on">
      <h2 className="text-[16px]">Fire-safety numbers</h2>
      <dl className="mt-3 space-y-3 text-[13px] leading-5">
        <div data-key="materials">
          <dt className="text-[11px] uppercase tracking-wider opacity-70">Tests per material</dt>
          <dd className="tabular-nums">{materials.map(([m, n]) => `${m} ${n}`).join(' · ')}</dd>
        </div>
        {outcomes.length > 0 && (
          <div data-key="outcomes">
            <dt className="text-[11px] uppercase tracking-wider opacity-70">NASA&apos;s stated outcome</dt>
            <dd className="tabular-nums">
              {statedTotal} of {rows.length} tests: {stated.map(([c, n]) => `${n} ${label(c)}`).join(' · ')}
            </dd>
          </div>
        )}
        <div data-key="scorecard">
          <dt className="text-[11px] uppercase tracking-wider opacity-70">Our simulator</dt>
          <dd className="tabular-nums">
            {scorecard.matched} of {scorecard.scored} scored tests match NASA ({scorecard.matchedTests.join(', ')})
            {links && (
              <>
                {' · '}
                <a {...linkProps(links.groupHref('bass'), () => links.openGroup('bass'))} className="underline underline-offset-2">
                  sandbox
                </a>
              </>
            )}
          </dd>
        </div>
        <div data-key="top">
          <dt className="text-[11px] uppercase tracking-wider opacity-70">Most habitat-relevant PSI investigation</dt>
          <dd className="tabular-nums">
            {top.name}, score {top.score} of 100 (equal weights)
            {links && (
              <>
                {' · '}
                <a {...linkProps(links.cardHref(top.id), () => links.showCard(top.id))} className="underline underline-offset-2">
                  ranking
                </a>
              </>
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}
