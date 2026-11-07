'use client'

/**
 * What we simulated, and why: every investigation's simulation status and
 * its reason (psi.json, from src/scripts/psi-catalogue.ts), with links to the
 * sandbox for the ones it can run. Also the status badge the cards show.
 */
import { SIM_STATUS, type PsiInvestigation, type PsiSimulation, type SimStatus } from '@/lib/psi'
import { linkProps, type WorkspaceLinks } from '../workspace/links'
import { C } from '../ui/chart-theme'

const TONE: Record<SimStatus, string> = { scored: C.green, 'by-hand': C.amber, 'not-testable': C.violet, none: C.muted }

export function StatusBadge({ sim }: { sim: PsiSimulation }) {
  const tone = TONE[sim.status]
  return (
    <span
      data-sim-status={sim.status}
      className="inline-block self-start whitespace-nowrap rounded px-1.5 py-0.5 text-[10px]"
      style={{ background: `${tone}22`, color: tone }}
    >
      {sim.label}
    </span>
  )
}

/** Where the sandbox can show an investigation: its presets, or the visual demo. */
function sandboxLink(id: string, links: WorkspaceLinks): { href: string; go: () => void; label: string } | null {
  if (id === 'bass-ii') return { href: links.groupHref('bass'), go: () => links.openGroup('bass'), label: 'BASS-II presets in the sandbox' }
  if (id === 'saffire-i-iii') return { href: links.groupHref('saffire'), go: () => links.openGroup('saffire'), label: 'Saffire presets in the sandbox' }
  if (id === 'cfi-g') return { href: links.demoHref(), go: links.openDemo, label: 'Gas flame demo (visual demo, not NASA-scored)' }
  return null
}

const ORDER = Object.keys(SIM_STATUS) as SimStatus[]

/** "1 simulated and scored · 1 compared by hand · …" */
export function simulatedSummary(investigations: PsiInvestigation[]): string {
  return ORDER.map((st) => [investigations.filter((i) => i.simulation.status === st).length, SIM_STATUS[st]] as const)
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label.toLowerCase()}`)
    .join(' · ')
}

export default function Simulated({
  investigations,
  links,
  onPick,
}: {
  investigations: PsiInvestigation[]
  links?: WorkspaceLinks
  /** Open an investigation's card details. */
  onPick: (id: string) => void
}) {
  const rows = [...investigations].sort((a, b) => ORDER.indexOf(a.simulation.status) - ORDER.indexOf(b.simulation.status))
  return (
    <div id="psi-simulated">
      <p className="text-[11px]" style={{ color: C.muted }}>
        Which investigations our sandbox can set up and check, and why the others can&apos;t: {simulatedSummary(investigations)}.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-[11px]">
          <thead>
            <tr style={{ color: C.muted }}>
              <th className="py-1 pr-3 font-medium">Investigation</th>
              <th className="py-1 pr-3 font-medium">Status</th>
              <th className="py-1 font-medium">Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => {
              const link = links ? sandboxLink(inv.id, links) : null
              return (
                <tr key={inv.id} data-sim-row={inv.id} className="border-t align-top" style={{ borderColor: C.line }}>
                  <td className="py-1.5 pr-3">
                    <button type="button" onClick={() => onPick(inv.id)} className="text-left hover:underline" style={{ color: C.fg }}>
                      {inv.name}
                    </button>
                    <span className="block text-[10px]" style={{ color: C.muted }}>{inv.psiId}</span>
                  </td>
                  <td className="py-1.5 pr-3"><StatusBadge sim={inv.simulation} /></td>
                  <td className="py-1.5 leading-5" style={{ color: C.fg }}>
                    <span data-sim-reason>{inv.simulation.reason}</span>
                    {link && (
                      <a
                        {...linkProps(link.href, link.go)}
                        data-sim-link={inv.id}
                        className="ml-2 whitespace-nowrap underline decoration-dotted underline-offset-2 hover:opacity-80"
                        style={{ color: C.amber }}
                      >
                        {link.label}
                      </a>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
