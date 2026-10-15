/**
 * Component/integration tests for the major dashboard interactions.
 *
 * These render the real components against real fixture rows (no mocks of the
 * logic under test) and assert the behaviours the acceptance criteria call
 * out: filters survive an empty selection, evidence scores recalculate when
 * weights change, heatmap counts agree with the data, the ranking never labels
 * materials by fire risk, and unsuitable datasets degrade gracefully.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import Visualization from '@/app/(frontend)/dashboard/components/visualization/Visualization'
import EvidenceRanking from '@/app/(frontend)/dashboard/components/evidence/EvidenceRanking'
import OxygenHeatmap from '@/app/(frontend)/dashboard/components/evidence/OxygenHeatmap'
import GenericCompare from '@/app/(frontend)/dashboard/components/visualization/GenericCompare'
import SourcesStrip from '@/app/(frontend)/dashboard/components/overview/SourcesStrip'
import { bandIndexFor, buildRowMapping, parseRows, resolveBass2Columns, deriveO2Bands } from '@/lib/combustion'
import type { DatasetMeta, DataRow } from '@/lib/types'

afterEach(cleanup)

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const columns = [
  { key: 'material', label: 'Material', type: 'category', unit: null, canonicalField: null },
  { key: 'test_no', label: 'Test No.', type: 'text', unit: null, canonicalField: null },
  { key: 'flow_restrictor', label: 'Flow restrictor', type: 'integer', unit: null, canonicalField: null },
  { key: 'air_velocity_cm_s_start', label: 'Air_Velocity_cm_s_Start', type: 'number', unit: 'cm/s', canonicalField: null },
  { key: 'calibrated_initial_o2', label: 'Calibrated initial O2', type: 'number', unit: '%', canonicalField: null },
  { key: 'calibrated_final_o2', label: 'Calibrated final O2', type: 'number', unit: '%', canonicalField: null },
  { key: 'initial_co', label: 'Initial CO', type: 'number', unit: 'ppm', canonicalField: null },
  { key: 'final_co', label: 'Final CO', type: 'number', unit: 'ppm', canonicalField: null },
  { key: 'initial_co2', label: 'Initial CO2', type: 'number', unit: '%', canonicalField: null },
  { key: 'final_co2', label: 'Final CO2', type: 'number', unit: '%', canonicalField: null },
] as DatasetMeta['columns']

const dataset: DatasetMeta = {
  id: 99,
  name: 'Fixture dataset',
  description: null,
  columns,
  rowCount: 4,
  lastImportedAt: null,
  papers: [],
}

const rows: DataRow[] = [
  { _id: 1, _index: 1, _paper: null, _page: null, material: 'PMMA', test_no: 'T1', flow_restrictor: 1, air_velocity_cm_s_start: 5, calibrated_initial_o2: 20, calibrated_final_o2: 18, initial_co: 0, final_co: 100, initial_co2: 0.4, final_co2: 1.0 },
  { _id: 2, _index: 2, _paper: null, _page: null, material: 'PMMA', test_no: 'T2', flow_restrictor: 1, air_velocity_cm_s_start: 8, calibrated_initial_o2: 21, calibrated_final_o2: 19.5, initial_co: 5, final_co: null, initial_co2: 0.4, final_co2: null, _rawData: { final_co: '>500' } },
  { _id: 3, _index: 3, _paper: null, _page: null, material: 'SIBAL', test_no: 'T3', flow_restrictor: 2, air_velocity_cm_s_start: 2, calibrated_initial_o2: 15, calibrated_final_o2: 14, initial_co: 0, final_co: 300, initial_co2: 0.4, final_co2: 2.0 },
  { _id: 4, _index: 4, _paper: null, _page: null, material: 'SIBAL', test_no: 'T4', flow_restrictor: 2, air_velocity_cm_s_start: 3, calibrated_initial_o2: 15.2, calibrated_final_o2: 15.0, initial_co: 1, final_co: 200, initial_co2: 0.5, final_co2: 1.5 },
]

const parsed = parseRows(rows, buildRowMapping(resolveBass2Columns(columns).resolutions))

/* ------------------------------------------------------------------ */
/* Visualization: filters + empty state                                */
/* ------------------------------------------------------------------ */

describe('Visualization empty state', () => {
  it('keeps the filters visible and offers a reset when no rows match', () => {
    render(<Visualization dataset={dataset} rows={rows} />)

    // PMMA + flow restrictor 2 → no rows
    fireEvent.click(screen.getByRole('button', { name: 'PMMA' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))

    expect(screen.getByText('No rows match the selected filters.')).toBeDefined()
    // Filters are still rendered and usable
    expect(screen.getAllByText('Material').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Flow restrictor').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'SIBAL' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeDefined()
  })

  it('recovers from the empty state without a reload', () => {
    render(<Visualization dataset={dataset} rows={rows} />)
    fireEvent.click(screen.getByRole('button', { name: 'PMMA' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText('No rows match the selected filters.')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(screen.queryByText('No rows match the selected filters.')).toBeNull()
    expect(screen.getAllByText(/4 of 4 rows/).length).toBeGreaterThan(0)
  })

  it('does not claim a numeric-column problem when the selection is simply empty', () => {
    render(<Visualization dataset={dataset} rows={rows} />)
    fireEvent.click(screen.getByRole('button', { name: 'PMMA' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.queryByText(/needs at least two numeric columns/i)).toBeNull()
  })

  it('reports O2 consumed from independently resolved initial/final columns', () => {
    render(<Visualization dataset={dataset} rows={rows} />)
    // mean of (2.0, 1.5, 1.0, 0.2) = 1.175 → displayed to 1 dp
    expect(screen.getByText('Mean O₂ consumed')).toBeDefined()
    expect(screen.getByText('1.2%')).toBeDefined()
    expect(screen.getByText('n=4 valid readings')).toBeDefined()
  })

  it('shows censored sensor markers with their original text instead of hiding them', () => {
    render(<Visualization dataset={dataset} rows={rows} />)
    // final_co ">500" on row 2 must appear as a marker in the data table
    expect(screen.getAllByText('>500').length).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------ */
/* Evidence ranking                                                    */
/* ------------------------------------------------------------------ */

describe('EvidenceRanking', () => {
  it('shows the scoring formula and the component columns', () => {
    render(<EvidenceRanking rows={parsed} />)
    expect(screen.getByText('Material Evidence Ranking')).toBeDefined()
    expect(screen.getAllByText(/Evidence Score/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Test Coverage/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/O₂ Condition Diversity/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/O₂ Range Coverage/).length).toBeGreaterThan(0)
  })

  it('recalculates scores when the weights change', () => {
    render(<EvidenceRanking rows={parsed} />)
    const table = screen.getAllByRole('table')[0]
    const scoreOf = (material: string) => {
      const row = within(table).getByText(material).closest('tr')!
      return within(row).getAllByRole('cell')[2].textContent
    }
    // Default 50/30/20: SIBAL has 2/2 tests, 2/2 O2 conditions, but only
    // 0.2 of PMMA's 1.0 O2 range → 50 + 30 + 0.2*20 = 84.
    expect(scoreOf('SIBAL')).toBe('84.0')

    // Push all weight onto Test Coverage.
    const sliders = screen.getAllByRole('slider') as HTMLInputElement[]
    fireEvent.change(sliders[0], { target: { value: '100' } })
    fireEvent.change(sliders[1], { target: { value: '0' } })
    fireEvent.change(sliders[2], { target: { value: '0' } })

    // Test coverage only → 2 of 2 tests = 100
    expect(scoreOf('SIBAL')).toBe('100.0')

    // Range coverage only → SIBAL 0.2/1.0 = 20
    fireEvent.change(sliders[0], { target: { value: '0' } })
    fireEvent.change(sliders[2], { target: { value: '100' } })
    expect(scoreOf('SIBAL')).toBe('20.0')
  })

  it('never labels materials by fire risk', () => {
    const { container } = render(<EvidenceRanking rows={parsed} />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/high[- ]risk|low[- ]risk|ignition probability|safe to use/i)
    expect(text).toMatch(/not how dangerous it is/i)
  })
})

/* ------------------------------------------------------------------ */
/* Oxygen heatmap                                                      */
/* ------------------------------------------------------------------ */

describe('OxygenHeatmap', () => {
  it('counts per material agree with the underlying valid O2 readings', () => {
    const { container } = render(<OxygenHeatmap rows={parsed} />)
    const table = container.querySelector('table')!
    const bands = deriveO2Bands(
      parsed.map((r) => r.o2i).filter((v): v is number => v !== null),
      { widthPct: 1 },
    )
    // Expected counts computed with the same band-resolution rule the
    // component uses (including the top-edge rule for the maximum reading).
    const counts = new Map<string, Map<number, number>>()
    for (const r of parsed) {
      if (r.o2i === null) continue
      const idx = bandIndexFor(bands, r.o2i)
      if (idx < 0) continue
      const row = counts.get(r.material) ?? new Map<number, number>()
      row.set(idx, (row.get(idx) ?? 0) + 1)
      counts.set(r.material, row)
    }

    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    const bandLabels = headers.slice(1, headers.length - 1) // drop Material + "No valid O₂"

    for (const [material, byBand] of counts) {
      const row = within(table).getByText(material).closest('tr')!
      const cells = within(row).getAllByRole('cell')
      let sum = 0
      bandLabels.forEach((label, i) => {
        const shown = Number(cells[i + 1].textContent)
        sum += shown
        const idx = bands.findIndex((b) => b.label === label)
        expect(shown).toBe(byBand.get(idx) ?? 0)
      })
      // every valid O2 reading appears exactly once in the material's row
      const validO2 = parsed.filter((r) => r.material === material && r.o2i !== null).length
      expect(sum).toBe(validO2)
    }
  })

  it('explains that empty cells are evidence gaps, not proof of safety', () => {
    render(<OxygenHeatmap rows={parsed} />)
    expect(screen.getByText(/evidence gap, not proof of safety/i)).toBeDefined()
  })
})

/* ------------------------------------------------------------------ */
/* Generic comparison                                                  */
/* ------------------------------------------------------------------ */

describe('GenericCompare', () => {
  const textOnly: DatasetMeta = {
    ...dataset,
    columns: [{ key: 'note', label: 'Note', type: 'text', unit: null, canonicalField: null }],
  }

  it('explains the requirement when a dataset has fewer than two numeric columns', () => {
    render(<GenericCompare dataset={textOnly} rows={rows} />)
    expect(screen.getByText(/needs at least two numeric columns/i)).toBeDefined()
  })

  it('offers configurable axes for any numeric columns', () => {
    const generic: DatasetMeta = {
      ...dataset,
      columns: [
        { key: 'specimen', label: 'Specimen', type: 'category', unit: null, canonicalField: null },
        { key: 'mass_g', label: 'Mass', type: 'number', unit: 'g', canonicalField: null },
        { key: 'duration_s', label: 'Duration', type: 'number', unit: 's', canonicalField: null },
      ],
    }
    const genericRows: DataRow[] = [
      { _id: 1, _index: 1, _paper: null, _page: null, specimen: 'A', mass_g: 10, duration_s: 5 },
      { _id: 2, _index: 2, _paper: null, _page: null, specimen: 'A', mass_g: null, duration_s: 9 },
    ]
    render(<GenericCompare dataset={generic} rows={genericRows} />)
    expect(screen.getByText('Compare Any Two Measurements')).toBeDefined()
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText(/1 skipped \(missing axis value\)/)).toBeDefined()
  })
})

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

describe('SourcesStrip', () => {
  it('marks an unverifiable paper as metadata only instead of linking it', () => {
    const ds: DatasetMeta = {
      ...dataset,
      papers: [
        { id: 1, title: 'Verified paper', ntrsId: '20210011385', sourceUrl: null },
        { id: 2, title: 'Unverified paper', ntrsId: null, sourceUrl: null },
      ],
    }
    render(<SourcesStrip dataset={ds} rows={rows} />)
    expect(screen.getByText(/Metadata only — no verified link/)).toBeDefined()
    const verified = screen.getByRole('link', { name: /20210011385/ })
    expect(verified.getAttribute('href')).toBe('https://ntrs.nasa.gov/citations/20210011385')
  })

  it('reports unresolved row-level paper references', () => {
    const ds: DatasetMeta = { ...dataset, papers: [{ id: 1, title: 'Known', ntrsId: '20210011385', sourceUrl: null }] }
    const withPaper: DataRow[] = rows.map((r, i) => ({ ...r, _paper: i === 0 ? 999 : 1 }))
    render(<SourcesStrip dataset={ds} rows={withPaper} />)
    expect(screen.getByText(/could\s+not be resolved/i)).toBeDefined()
  })
})
