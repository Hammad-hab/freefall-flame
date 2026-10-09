import Link from 'next/link'
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google'
import './global.css'
import { Metadata } from 'next'

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' })
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument' })

export const metadata: Metadata = {
  title: 'Flame in Freefall',
  description:
    "Search, compare, and rank NASA's microgravity combustion experiments for Moon and Mars fire safety.",
}

const h2 =
  'font-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold leading-[1.15] tracking-[-0.01em]'
const btn =
  'inline-block rounded-md border px-5 py-3 text-[0.95rem] font-semibold transition-colors'
const btnPrimary = `${btn} border-flame-amber bg-flame-amber text-[#1a0f05] hover:bg-[#ffb868]`
const btnGhost = `${btn} border-line hover:border-muted`

const FEATURES = [
  { term: 'Explore', desc: 'Filter experiments by fuel, oxygen level, pressure, airflow, and gravity.' },
  { term: 'Compare', desc: 'Plot any two measurements across experiments on the same chart.' },
  {
    term: 'Rank',
    desc: 'Score findings by what matters for a mission. The formula and weights are visible, and you can change them.',
  },
  {
    term: 'Ask',
    desc: 'Ask what a result means for a lunar habitat and get an answer with sources.',
  },
]

const SOURCES = [
  {
    name: 'Physical Sciences Informatics',
    desc: 'Experiment records and test conditions from ISS combustion investigations.',
  },
  { name: 'NASA Technical Reports Server', desc: 'The papers and reports behind the numbers.' },
  { name: 'NASA Task Book', desc: 'Project descriptions and bibliographies for combustion research.' },
]

export default function HomePage() {
  return (
    <div className={`${display.variable} ${body.variable} min-h-screen font-body leading-relaxed`}>
      <div className="mx-auto max-w-280 px-6">
        <header className="flex items-center justify-between py-5">
          <Link href="/" className="font-display text-lg font-bold">
            Flame in Freefall
          </Link>
          <nav aria-label="Main" className="flex gap-7 text-[0.95rem] text-muted">
            <Link href="/dashboard" className="transition-colors hover:text-fg">
              Dashboard
            </Link>
            <Link href="/sources" className="transition-colors hover:text-fg">
              Sources
            </Link>
            <Link href="/sandbox" className="transition-colors hover:text-fg">
              Sandbox
            </Link>
          </nav>
        </header>

        <section className="grid items-center gap-10 pt-14 pb-14 md:grid-cols-[1.05fr_0.95fr] md:gap-14 md:pb-22">
          <div>
            <h1 className="mb-5 font-display text-[clamp(2.4rem,5vw,3.9rem)] leading-[1.05] font-bold tracking-[-0.02em]">
              Fire behaves differently in space. Compare how.
            </h1>
            <p className="mb-8 max-w-[52ch] text-[1.15rem] text-muted">
              Search NASA&apos;s microgravity combustion experiments, plot them on one chart, and
              rank what matters for Moon and Mars missions. Every result links back to its paper.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className={btnPrimary}>
                Open the dashboard
              </Link>
              <Link href="/sources" className={btnGhost}>
                Browse sources
              </Link>
            </div>
          </div>
          {/*<FlameDemo />*/}
        </section>

        <section className="border-t border-line py-18">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-14">
            <h2 className={h2}>What you can do here</h2>
            <dl>
              {FEATURES.map((f) => (
                <div
                  key={f.term}
                  className="grid gap-1 border-b border-line py-5 first:pt-0 last:border-b-0 md:grid-cols-[120px_1fr] md:gap-6"
                >
                  <dt className="font-display text-xl font-semibold">{f.term}</dt>
                  <dd className="text-muted">{f.desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t border-line py-18">
          <h2 className={h2}>Built from NASA&apos;s open records</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-0">
            {SOURCES.map((s) => (
              <div
                key={s.name}
                className="md:border-l md:border-line md:px-7 md:first:border-l-0 md:first:pl-0"
              >
                <h3 className="mb-2 font-display text-[1.1rem] font-semibold">{s.name}</h3>
                <p className="text-[0.95rem] text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
          <Link
            href="/sources"
            className="mt-8 inline-block text-flame-blue hover:underline"
          >
            See all sources
          </Link>
        </section>

        <section className="border-t border-line py-18">
          <div className="grid items-center gap-10 rounded-[10px] border border-line bg-ink-2 p-7 md:grid-cols-[1.1fr_0.9fr] md:p-10">
            <div>
              <h2 className={h2}>Bring your own dataset</h2>
              <p className="mt-3 max-w-[52ch] text-muted">
                Admins can add new experiments, papers, and CSV files without touching code. New
                data shows up on every chart once it is published.
              </p>
            </div>
            <div>
              <ol className="mb-6 list-decimal pl-5 [&>li]:py-1">
                <li>Upload a CSV or a paper</li>
                <li>Map its columns to the standard fields</li>
                <li>Review the rows</li>
                <li>Publish</li>
              </ol>
              <Link href="/admin" className={btnGhost}>
                Admin sign-in
              </Link>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 border-t border-line pt-7 pb-10 text-sm text-muted">
          <span>Built for the NASA Space Apps Challenge 2026.</span>
          <span>Independent project using open NASA data. Not affiliated with NASA.</span>
        </footer>
      </div>
    </div>
  )
}