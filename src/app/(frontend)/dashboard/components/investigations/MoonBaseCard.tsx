'use client'

/**
 * The Moon-base scenario card, labelled an extrapolation: 34% O2 (the top of
 * the exploration range) and the Moon's 0.17 g. It says first what the data
 * cannot support, then counts what the PSI tables hold at 30% O2 or more
 * (from psi.json), then offers the sandbox what-if.
 */
import type { MoonBase } from '@/lib/psi'
import { linkProps, type WorkspaceLinks } from '../workspace/links'
import { C, panelCls, panelStyle } from '../ui/chart-theme'

export default function MoonBaseCard({ moon, links }: { moon: MoonBase; links?: WorkspaceLinks }) {
  return (
    <section id="psi-moon" className={panelCls} style={{ ...panelStyle, borderColor: `${C.amber}66` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
          Moon-base scenario: {moon.o2Pct}% O2, {moon.gravityG} g
        </h3>
        <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: `${C.amber}22`, color: C.amber }}>extrapolation</span>
      </div>

      <ul id="psi-moon-limits" className="mt-2 space-y-1 text-[12px] leading-5" style={{ color: C.fg }}>
        <li>
          No solid-material test in these tables goes above {moon.solidMaxO2Pct}% O2 (BASS-II; Saffire&apos;s highest is{' '}
          {moon.saffireMaxO2Pct}%).
        </li>
        <li>Pressure isn&apos;t modelled: the sandbox engine runs at 1 atm, whatever the scenario.</li>
      </ul>
      <p className="mt-2 text-[11px]" style={{ color: C.muted }}>
        {moon.o2Pct}% O2 is the top of the exploration range (32-34% at 8.0-8.2 psia); 0.17 g is the Moon&apos;s gravity.
        What the PSI tables do hold at 30% O2 or more:
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-[11px]">
          <thead>
            <tr style={{ color: C.muted }}>
              <th className="py-1 pr-3 font-medium">Investigation</th>
              <th className="py-1 pr-3 font-medium">At 30% O2 or more</th>
              <th className="py-1 pr-3 font-medium">At 34%</th>
              <th className="py-1 pr-3 font-medium">At 0.7 atm or less</th>
              <th className="py-1 font-medium">Outcomes there</th>
            </tr>
          </thead>
          <tbody>
            {moon.near.map((n) => (
              <tr key={n.investigation} className="border-t align-top" style={{ borderColor: C.line, color: C.fg }} data-moon-row={n.investigation}>
                <td className="py-1 pr-3">
                  {n.investigation}
                  <span className="block text-[10px]" style={{ color: C.muted }}>{n.what}</span>
                </td>
                <td className="py-1 pr-3 tabular-nums">{n.atLeast30} {n.unit}</td>
                <td className="py-1 pr-3 tabular-nums">{n.at34}</td>
                <td className="py-1 pr-3 tabular-nums">{n.lowPressure === null ? 'not in the table' : n.lowPressure}</td>
                <td className="py-1 tabular-nums">{n.outcomes ? n.outcomes.map((o) => `${o.value} ${o.count}`).join(' · ') : 'not in the table'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px]" style={{ color: C.muted }}>
        All of these are gas flames or fuel droplets, not cabin solids, so they show how flames behave in oxygen-rich air,
        not how habitat materials burn.
      </p>

      <div className="mt-3 rounded-xl border p-3 text-[11px] leading-5" style={{ borderColor: C.line, background: C.ink }}>
        <div style={{ color: C.fg }}>
          Sandbox what-if: BASS-II test B1 (PMMA film 0.1 mm, air 5 cm/s) as NASA ran it, with only the oxygen raised to{' '}
          {moon.o2Pct}% and gravity set to {moon.gravityG} g.
        </div>
        <div className="mt-1" style={{ color: C.amber }}>
          extrapolation: not validated above {moon.solidMaxO2Pct}% O2; pressure is not modelled (the engine runs at 1 atm).
        </div>
        {links && (
          <a
            {...linkProps(links.moonHref(), links.openMoon)}
            data-moon-link
            className="mt-2 inline-block underline decoration-dotted underline-offset-2 hover:opacity-80"
            style={{ color: C.amber }}
          >
            Run the what-if in the sandbox
          </a>
        )}
      </div>
    </section>
  )
}
