'use client'

/** Conclusions tab: what the PSI data shows, where it's blind, what to do next. */

const FINDINGS = [
  {
    title: 'Still air is not safe air',
    body: 'ACME BRE showed materials burning for minutes with no airflow in proposed crew-vehicle atmospheres. A calm cabin is not a safeguard.',
    src: 'ACME BRE',
  },
  {
    title: 'Suppression has a measurable threshold',
    body: 'Methanol droplets had a limiting oxygen index around 12-13% O₂, and CO₂ or helium dilution shifts it. Designers can size suppression against numbers.',
    src: 'FLEX',
  },
  {
    title: 'A dead visible flame is not a dead fire',
    body: 'Large heptane droplets kept burning as an invisible cool flame after the visible flame went out. Procedures cannot rely on what the crew can see.',
    src: 'FLEX',
  },
  {
    title: 'Smoke detection lags in microgravity',
    body: 'Most smoke particles were under 500 nm and transport is mixing-dominated, so detectors tuned on Earth smoke can respond late.',
    src: 'SAME / SAME-R',
  },
  {
    title: 'Oxygen and airflow set how a solid burns',
    body: 'In BASS-II, flame length, soot and stability changed with ambient O₂ and flow velocity. More oxygen means a bigger hazard; the direction is clear.',
    src: 'BASS-II',
  },
]

const GAPS = [
  'No solid-material test above ~22% O₂. Moon-base air is expected at 30%+.',
  'No partial-gravity data in PSI. Microgravity and 1 g can only bound lunar gravity.',
  'The highest-O₂ tests (CFI-G, up to 85%) burned gas flames, not cabin materials.',
  'Pressure is not modelled in the sandbox (1 atm), so its what-ifs are illustrative only.',
]

const RECS = [
  'Treat low airflow as a risk, not a safeguard.',
  'Size suppression around dilution thresholds, and confirm the fire is out beyond visible flame.',
  'Test cabin solids at lunar O₂ and pressure. LUCI and FM2 are the experiments to watch.',
  'Re-tune smoke detectors for microgravity particle sizes and transport delay.',
]

// O₂ coverage, % by volume. Figures from the papers and challenge page.
const BARS = [
  { label: 'Solids (BASS-II, Saffire)', from: 0, to: 22.2, tone: 'solid' },
  { label: 'FLEX droplets', from: 12, to: 30, tone: 'other' },
  { label: 'CFI-G gas flames', from: 0, to: 85, tone: 'other' },
] as const

const X = (pct: number) => 40 + (pct / 100) * 560

function CoverageBar() {
  return (
    <svg viewBox="0 0 620 230" role="img" className="w-full max-w-3xl"
         aria-label="Oxygen concentration tested by investigation versus Moon base range">
      {/* Moon-base band */}
      <rect x={X(30)} y={10} width={X(34) - X(30)} height={170} fill="currentColor" opacity={0.18} />
      <text x={X(32)} y={22} fontSize={10} textAnchor="middle" fill="currentColor">Moon base</text>
      <text x={X(32)} y={34} fontSize={10} textAnchor="middle" fill="currentColor">30%+</text>

      {BARS.map((b, i) => (
        <g key={b.label}>
          <rect x={X(b.from)} y={50 + i * 40} width={X(b.to) - X(b.from)} height={18} rx={3}
                fill="currentColor" opacity={b.tone === 'solid' ? 0.85 : 0.4} />
          <text x={X(b.to) + 6} y={63 + i * 40} fontSize={11} fill="currentColor">{b.label}</text>
        </g>
      ))}

      {/* axis */}
      <line x1={40} y1={185} x2={600} y2={185} stroke="currentColor" opacity={0.5} />
      {[0, 21, 50, 100].map((t) => (
        <g key={t}>
          <line x1={X(t)} y1={185} x2={X(t)} y2={190} stroke="currentColor" />
          <text x={X(t)} y={204} fontSize={10} textAnchor="middle" fill="currentColor">{t}%</text>
        </g>
      ))}
      <text x={X(21)} y={218} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.7}>Earth air</text>
      <text x={X(100)} y={218} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.7}>Spacesuit</text>
    </svg>
  )
}

export default function Conclusions() {
  return (
    <div id="conclusions" data-conclusions className="space-y-8 p-6 max-w-4xl">
      <section>
        <h2 className="text-2xl font-semibold">Conclusions</h2>
        <p className="mt-2 text-lg">
          Microgravity fire research gives firm answers on suppression, smoke detection and the
          role of oxygen and airflow. It gives none for solid materials at Moon-base oxygen
          or lunar gravity, so for habitats it bounds the risk and does not predict it.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold">What the data shows</h3>
        <ol className="mt-3 space-y-3">
          {FINDINGS.map((f, i) => (
            <li key={f.title}>
              <strong>{i + 1}. {f.title}.</strong> {f.body}{' '}
              <span className="opacity-60">({f.src})</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Where the evidence stops</h3>
        <p className="mt-1 opacity-80">
          Oxygen range each investigation tested, against the expected Moon-base air.
        </p>
        <CoverageBar />
        <ul className="mt-3 list-disc pl-5 space-y-1">
          {GAPS.map((g) => <li key={g}>{g}</li>)}
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Recommendations</h3>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          {RECS.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Beyond space</h3>
        <p className="mt-1">
          The same research produced fine-water-mist extinguishers, better smoke detection and
          firefighter protective gear on Earth.
        </p>
      </section>
    </div>
  )
}