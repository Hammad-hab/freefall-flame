import Link from 'next/link'
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google'
import './global.css'
import { Metadata } from 'next'
import { DEFAULT_WEIGHTS, rank, rankLabel, type PsiCatalogue } from '@/lib/psi'
import psi from './dashboard/components/investigations/psi.json'
// Made by src/scripts/home-flame.ts from the sandbox engine (not drawn by hand).
import flame from './home-flame.json'

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' })
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument' })

export const metadata: Metadata = {
  title: 'Flame in Freefall',
  description:
    "NASA's 14 PSI combustion investigations, ranked for crew-habitat fire safety, with the BASS-II tests in a sandbox that says how often it matches NASA.",
}

const h2 =
  'font-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold leading-[1.15] tracking-[-0.01em]'
const btn =
  'inline-block rounded-md border px-5 py-3 text-[0.95rem] font-semibold transition-colors'
const btnPrimary = `${btn} border-flame-amber bg-flame-amber text-on hover:brightness-110`
const btnGhost = `${btn} border-line hover:border-muted`

// What the dashboard does today (feat/polish rewrote these to match it).
const FEATURES = [
  {
    term: 'Catalogue',
    desc: "NASA's 14 PSI combustion investigations, one card each: what was burned, oxygen, pressure, flow, tests and outcomes, computed from the cleaned tables.",
  },
  {
    term: 'Rank',
    desc: 'Rank them for crew-habitat fire safety on five criteria. The formula, the weights and the reference values are on screen, and you can change the weights.',
  },
  {
    term: 'BASS-II',
    desc: "Charts and a data table for NASA's 129 BASS-II tests: gas readings, stated outcomes, thickness and rod diameter, each test linked to its sandbox preset.",
  },
  {
    term: 'Simulate',
    desc: 'Run each BASS-II test in a combustion sandbox and see whether it ends as NASA reported. It matches 4 of the 26 tests NASA scored, and the page says so.',
  },
  {
    term: 'Ask',
    desc: "Plain-language AI explanations grounded in the data on screen, labelled as interpretations. For the investigation summaries, an answer with a number that isn't in the data is replaced by a plain summary.",
  },
  {
    term: 'Moon base',
    desc: 'A Moon-base card (34% O2, 0.17 g), labelled as an extrapolation: what the tables hold near that oxygen, and a sandbox what-if.',
  },
]

const SOURCES = [
  {
    name: 'Physical Sciences Informatics',
    desc: "NASA's tables for 14 ISS combustion investigations, cleaned without inventing values.",
  },
  { name: 'NASA Technical Reports Server', desc: 'The BASS-II papers we have checked; other investigations cite their PSI table.' },
  { name: 'Stated assumptions', desc: 'ISS air, the exploration atmosphere (Norcross et al. 2013) and cabin ventilation (SAE 932191), shown with the ranking.' },
]

// The ranking at equal weights, as the Investigations tab opens: the top 5 for the preview.
const RANKED = rank((psi as PsiCatalogue).investigations, DEFAULT_WEIGHTS)!
const TOP5 = RANKED.slice(0, 5)

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
              Explore NASA&apos;s microgravity combustion investigations, rank them for crew-habitat fire
              safety, and run the BASS-II tests in a sandbox that says honestly how often it matches NASA.
              Every number comes from NASA&apos;s tables, and every card names its source.
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
          <figure id="home-flame" className="overflow-hidden rounded-[10px] border border-line bg-ink-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static PNG; sharp pixels (no resampling) wanted */}
            <img
              src={flame.image}
              width={flame.width}
              height={flame.height}
              alt={`Sandbox Temperature view: BASS-II test ${flame.testId} at step ${flame.step}, ${flame.outcomeAtStep}. The hot gas trails downstream of the burning end of the sample; the rest of the sample, still cold, is shown faintly in green.`}
              className="block h-auto w-full [image-rendering:pixelated]"
            />
            <figcaption className="px-4 py-3 text-[0.8rem] text-muted">
              BASS-II test {flame.testId} at step {flame.step} ({flame.outcomeAtStep}), the Temperature view (fuel shown faintly), rendered by the
              sandbox engine itself.{' '}
              <Link href="/dashboard?tab=sandbox&preset=B14" className="text-flame-blue hover:underline">
                Run it in the sandbox
              </Link>
            </figcaption>
          </figure>
        </section>

        <section id="home-ranking" className="border-t border-line py-14">
          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-14">
            <div>
              <h2 className={h2}>Ranked for habitat fire safety</h2>
              <p className="mt-3 text-muted">
                NASA&apos;s {RANKED.length} PSI combustion investigations, scored on five stated criteria at equal weights.
                A score is relevance to habitat fire safety, not fire risk.
              </p>
              <Link href="/dashboard?tab=investigations" className="mt-5 inline-block text-flame-blue hover:underline">
                See all {RANKED.length}, change the weights
              </Link>
            </div>
            <ol className="space-y-2.5 self-center">
              {TOP5.map((r) => {
                const label = rankLabel(r, RANKED)
                return (
                  <li key={r.id} data-home-rank={r.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(6rem,40%)_2.5rem] items-center gap-3">
                    <span className="text-right tabular-nums text-muted">{label.endsWith('=') ? label : `${label}.`}</span>
                    <span className="truncate font-display text-[1.05rem] font-semibold">{r.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-line">
                      <span className="block h-full rounded-full bg-flame-amber" style={{ width: `${r.score}%` }} />
                    </span>
                    <span className="text-right tabular-nums">{r.score}</span>
                  </li>
                )
              })}
            </ol>
          </div>
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

        <section id="home-byod" className="border-t border-line py-8">
          <h3 className="font-display text-[1.05rem] font-semibold">Bring your own dataset</h3>
          <p className="mt-1 max-w-[70ch] text-[0.9rem] text-muted">
            Admins can add a dataset and its papers in the admin panel without touching code: define its columns, upload
            the CSV under Dataset Imports (&quot;Check only&quot; validates first), link its papers and publish it. It then
            opens at /dashboard?dataset=…, with charts for the columns they recognise.{' '}
            <Link href="/admin" className="text-flame-blue hover:underline">
              Admin sign-in
            </Link>
          </p>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 border-t border-line pt-7 pb-10 text-sm text-muted">
          <span>Built for the NASA Space Apps Challenge 2026.</span>
          <span>Independent project using open NASA data. Not affiliated with NASA.</span>
        </footer>
      </div>
    </div>
  )
}