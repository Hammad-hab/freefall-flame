'use client'
import { O2CoverageChart } from './O2CoverageChart'


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

const BIAS = [
  {title: "Data is heavily inclined towards PMMA", body: `A large share of the tests (75.9% of valid runs, 98/129 tests recorded PMMA) used PMMA, a homogeneous, well-characterized solid commonly chosen as a reference fuel. This makes PMMA the best-covered material by a wide margin, but that reflects experimental convention, not relevance to real fire scenarios. Spacecraft fires are more likely to involve a mixture of materials with varying composition, geometry, and thermal properties, so conclusions drawn from PMMA may not generalize. Coverage for other materials is sparser and uneven, which limits how much can be said about how fires would behave across realistic fuel combinations.`}
]

// O₂ coverage, % by volume. Figures from the papers and challenge page.
const BARS = [
  { label: 'Solids (BASS-II, Saffire)', from: 0, to: 22.2, tone: 'solid' },
  { label: 'FLEX droplets', from: 12, to: 30, tone: 'other' },
  { label: 'CFI-G gas flames', from: 0, to: 85, tone: 'other' },
] as const

const X = (pct: number) => 40 + (pct / 100) * 560

export default function Conclusions() {
  return (
    <div id="conclusions" data-conclusions className="space-y-8 p-6 max-w-4xl m-auto">
      <section>
        <h2 className="text-3xl font-semibold">Conclusions</h2>
        <p className="mt-2 text-md">
          Microgravity fire research gives firm answers on suppression, smoke detection and the
          role of oxygen and airflow. It gives none for solid materials at Moon-base oxygen
          or lunar gravity, so for habitats it bounds the risk and does not predict it.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold">What the data shows</h3>
        <ol className="mt-3 space-y-3 text-sm">
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
        <p className="mt-1 opacity-80 text-md">
          Oxygen range each investigation tested, against the expected Moon-base air.
        </p>
        <O2CoverageChart />   {/* was <CoverageBar /> */}
        <ul className="mt-3 list-disc pl-5 space-y-1 text-sm">
          {GAPS.map((g) => <li key={g}>{g}</li>)}
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Biases in Data</h3>
        <ul className="mt-3 list-disc pl-5 space-y-1 text-sm">
          <div className="mt-3 space-y-3 text-sm">
            {BIAS.map((f, i) => (
              <div key={f.title}>
                <strong>{i + 1}. {f.title}.</strong>
                <br />
                <p className='ml-5'>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Recommendations</h3>
        <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
          {RECS.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Beyond space</h3>
        <p className="mt-1 text-sm">
          The same research produced fine-water-mist extinguishers, better smoke detection and
          firefighter protective gear on Earth.
        </p>
      </section>
    </div>
  )
}