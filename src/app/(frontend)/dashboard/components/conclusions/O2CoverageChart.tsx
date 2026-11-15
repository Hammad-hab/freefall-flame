import { useState } from 'react'

type Range = {
  label: string
  group: 'solid' | 'other'
  min: number
  max: number
  openLeft?: boolean // lower bound not sourced, so the bar fades out on the left
  note: string
}

// O₂ % by volume. Maxima and FLEX range are from the papers and challenge page.
const RANGES: Range[] = [
  { label: 'BASS-II (solids)', group: 'solid', min: 0, max: 22.2, openLeft: true,
    note: 'Highest O₂ in the solid-material tables: 22.2%. Lower bound not shown.' },
  { label: 'Saffire (solids)', group: 'solid', min: 0, max: 22.1, openLeft: true,
    note: 'Highest O₂ on Saffire: 22.1%. Lower bound not shown.' },
  { label: 'FLEX (droplets)', group: 'other', min: 12, max: 30,
    note: 'Fuel droplets from 12% to 30% O₂, with CO₂ or helium dilution.' },
  { label: 'CFI-G (gas flames)', group: 'other', min: 0, max: 85, openLeft: true,
    note: 'Gas flames with up to 85% O₂ from a spherical burner. Not cabin solids.' },
]

const MOON = { from: 30, to: 34 }
const W = 760, H = 330
const M = { l: 150, r: 24, t: 44, b: 52 }
const x = (v: number) => M.l + (v / 100) * (W - M.l - M.r)
const rowH = 48
const y = (i: number) => M.t + i * rowH

export function O2CoverageChart() {
  const [hover, setHover] = useState<number | null>(null)
  const solidCeiling = Math.max(...RANGES.filter(r => r.group === 'solid').map(r => r.max))
  const plotBottom = M.t + RANGES.length * rowH

  return (
    <figure className="max-w-3xl">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label="Oxygen concentration tested by each investigation compared with Moon-base air">
        <defs>
          <linearGradient id="fadeLeft" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="0.35" stopColor="currentColor" stopOpacity="1" />
          </linearGradient>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse"
                   patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
          </pattern>
        </defs>

        {/* gridlines + x ticks */}
        {Array.from({ length: 11 }, (_, i) => i * 10).map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={M.t - 8} y2={plotBottom} stroke="currentColor" opacity={0.12} />
            <text x={x(t)} y={plotBottom + 18} fontSize={11} textAnchor="middle" fill="currentColor" opacity={0.7}>
              {t}
            </text>
          </g>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 8} fontSize={12} textAnchor="middle" fill="currentColor">
          Oxygen concentration (% by volume)
        </text>

        {/* untested-for-solids gap */}
        <rect x={x(solidCeiling)} y={M.t - 8} width={x(MOON.from) - x(solidCeiling)}
              height={plotBottom - M.t + 8} fill="url(#hatch)" />
        <text x={(x(solidCeiling) + x(MOON.from)) / 2} y={M.t - 14} fontSize={10}
              textAnchor="middle" fill="currentColor" opacity={0.8}>
          no solid tests
        </text>

        {/* Moon-base band */}
        <rect x={x(MOON.from)} y={M.t - 8} width={x(MOON.to) - x(MOON.from)}
              height={plotBottom - M.t + 8} fill="currentColor" opacity={0.2} />
        <text x={x((MOON.from + MOON.to) / 2)} y={M.t - 14} fontSize={10} fontWeight={600}
              textAnchor="middle" fill="currentColor">
          Moon base
        </text>

        {/* Earth air reference */}
        <line x1={x(21)} x2={x(21)} y1={M.t - 8} y2={plotBottom} stroke="currentColor"
              strokeDasharray="4 3" opacity={0.7} />
        <text x={x(21)} y={M.t - 14} fontSize={10} textAnchor="end" dx={-4} fill="currentColor" opacity={0.8}>
          Earth air 21%
        </text>

        {/* bars */}
        {RANGES.map((r, i) => (
          <g key={r.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
             onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}
             style={{ cursor: 'default', outline: 'none' }}>
            <text x={M.l - 10} y={y(i) + 24} fontSize={12} textAnchor="end" fill="currentColor"
                  fontWeight={hover === i ? 700 : 400}>
              {r.label}
            </text>
            <rect x={x(r.min)} y={y(i) + 8} width={x(r.max) - x(r.min)} height={24} rx={4}
                  fill={r.openLeft ? 'url(#fadeLeft)' : 'currentColor'}
                  opacity={r.group === 'solid' ? 0.95 : hover === i ? 0.7 : 0.5} />
            <text x={x(r.max) + 6} y={y(i) + 25} fontSize={11} fill="currentColor">{r.max}%</text>
          </g>
        ))}
      </svg>

      {/* legend + readout */}
      <figcaption className="mt-2 text-sm space-y-1">
        <div className="flex flex-wrap gap-x-5 gap-y-1 opacity-80">
          <span>■ solid materials (what a habitat is made of)</span>
          <span>▒ other flames and droplets</span>
          <span>▨ untested for solids</span>
        </div>
        <p className="min-h-[2.5rem]">
          {hover !== null
            ? RANGES[hover].note
            : `Solids stop at ${solidCeiling}% O₂. Moon-base air (${MOON.from}-${MOON.to}%) sits beyond the evidence.`}
        </p>
      </figcaption>
    </figure>
  )
}
