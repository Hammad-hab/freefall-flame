import Link from 'next/link'
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google'
import '@/app/(frontend)/global.css'
import { Metadata } from 'next'
import type { PsiCatalogue } from '@/lib/psi'
import data from '../dashboard/components/investigations/psi.json'

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' })
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument' })

export const metadata: Metadata = {
  title: 'Flame in Freefall - Sources',
  description: "The NASA tables, papers and stated assumptions behind the dashboard's numbers.",
}

/**
 * Every source the dashboard uses, built from psi.json (src/scripts/psi-catalogue.ts):
 * each investigation's PSI table and cleaned file, the papers we have (from
 * data/psi/sources.json; only hand-checked ones), and the stated reference values.
 */
const catalogue = data as PsiCatalogue
const h2 = 'font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-[1.15] tracking-[-0.01em]'

export default function SourcesPage() {
  const ref = catalogue.reference
  const papers = catalogue.investigations.flatMap((i) =>
    i.sources.filter((s) => s.kind === 'paper').map((s) => ({ investigation: i.name, ...(s as Extract<typeof s, { kind: 'paper' }>) })),
  )
  return (
    <div className={`${display.variable} ${body.variable} min-h-screen font-body leading-relaxed`}>
      <div className="mx-auto max-w-280 px-6">
        <header className="flex items-center justify-between py-5">
          <Link href="/" className="font-display text-lg font-bold">Flame in Freefall</Link>
          <nav aria-label="Main" className="flex gap-7 text-[0.95rem] text-muted">
            <Link href="/dashboard" className="transition-colors hover:text-fg">Dashboard</Link>
            <Link href="/sources" className="text-fg">Sources</Link>
            <Link href="/sandbox" className="transition-colors hover:text-fg">Sandbox</Link>
          </nav>
        </header>

        <section className="pt-10 pb-10">
          <h1 className="mb-4 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] font-bold tracking-[-0.02em]">Sources</h1>
          <p className="max-w-[62ch] text-muted">
            Every number in the dashboard comes from one of NASA&apos;s Physical Sciences Informatics (PSI) tables,
            cleaned without inventing values (each problem is flagged in the table). Papers are listed only where we
            have checked them. The ranking also uses three stated assumptions, listed at the end.
          </p>
        </section>

        <section id="sources-papers" className="border-t border-line py-10">
          <h2 className={h2}>Papers</h2>
          <ul className="mt-6 space-y-4">
            {papers.map((p) => (
              <li key={p.ntrsId}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-flame-blue hover:underline">{p.title}</a>
                <div className="text-sm text-muted">NTRS {p.ntrsId} · {p.investigation}</div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">
            The other {catalogue.investigations.length - new Set(papers.map((p) => p.investigation)).size} investigations
            are cited by their PSI table only, until their papers have been checked.
          </p>
        </section>

        <section id="sources-tables" className="border-t border-line py-10">
          <h2 className={h2}>NASA PSI tables ({catalogue.investigations.length})</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[0.92rem]">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Investigation</th>
                  <th className="py-2 pr-4 font-medium">PSI id</th>
                  <th className="py-2 pr-4 font-medium">What was burned</th>
                  <th className="py-2 pr-4 font-medium">Rows</th>
                  <th className="py-2 font-medium">Cleaned file</th>
                </tr>
              </thead>
              <tbody>
                {catalogue.investigations.map((i) => (
                  <tr key={i.id} className="border-t border-line align-top" data-source-row={i.id}>
                    <td className="py-2 pr-4">{i.name}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{i.psiId}</td>
                    <td className="py-2 pr-4 text-muted">{i.fuels}</td>
                    <td className="py-2 pr-4 tabular-nums">{i.rows} <span className="text-muted">({i.granularity})</span></td>
                    <td className="py-2 font-mono text-[0.85rem] text-muted">{i.cleanedFile}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted">
            The cleaned files and their notes are in the project&apos;s <span className="font-mono">data/psi/</span> folder.
            The dashboard&apos;s{' '}
            <Link href="/dashboard?tab=investigations" className="text-flame-blue hover:underline">Investigations</Link> tab
            shows each one as a card.
          </p>
        </section>

        <section id="sources-assumptions" className="border-t border-line py-10">
          <h2 className={h2}>Stated assumptions</h2>
          <p className="mt-3 max-w-[62ch] text-muted">
            The habitat ranking compares each table with these values. They are not NASA PSI data.
          </p>
          <ul className="mt-6 space-y-4">
            <li><span className="font-semibold">{ref.iss.label}:</span> <span className="text-muted">{ref.iss.text}.</span></li>
            <li>
              <span className="font-semibold">{ref.exploration.label}:</span> <span className="text-muted">{ref.exploration.text}</span>
              <div className="text-sm text-muted">Source: {ref.exploration.source}.</div>
            </li>
            <li>
              <span className="font-semibold">{ref.ventilation.label}:</span> <span className="text-muted">{ref.ventilation.text}.</span>
              <div className="text-sm text-muted">Source: {ref.ventilation.source}.</div>
            </li>
          </ul>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 border-t border-line pt-7 pb-10 text-sm text-muted">
          <span>Built for the NASA Space Apps Challenge 2026.</span>
          <span>Independent project using open NASA data. Not affiliated with NASA.</span>
        </footer>
      </div>
    </div>
  )
}
