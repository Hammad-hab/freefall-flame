/**
 * feat/ui-visuals: the Overview's judge-facing cards (tests per material,
 * the scorecard) and "About this dataset", closed, holding the developer
 * cards.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { AboutDataset, MaterialsCard, ScorecardCard, materialCounts } from '@/app/(frontend)/dashboard/components/overview/OverviewCards'
import { buildRowMapping, parseRows, resolveBass2Columns } from '@/lib/combustion'
import type { DatasetMeta, DataRow } from '@/lib/types'
import scorecard from '@/app/(frontend)/dashboard/components/sandbox/scorecard.json'

afterEach(cleanup)

const columns = [
  { key: 'test_no', label: 'Test No.', type: 'text' },
  { key: 'material', label: 'Material', type: 'category', canonicalField: 'material' },
] as DatasetMeta['columns']
const base = { _id: 1, _index: 1, _paper: null, _page: null }
const rows: DataRow[] = ['PMMA', 'PMMA', 'PMMA', 'SIBAL fabric', 'Nomex', 'SIBAL fabric'].map((m, k) => ({ ...base, test_no: `T${k}`, material: m }))
const parsed = parseRows(rows, buildRowMapping(resolveBass2Columns(columns).resolutions))

describe('Overview cards', () => {
  it('counts tests per material, most first, and draws one bar each', () => {
    expect(materialCounts(parsed)).toEqual([['PMMA', 3], ['SIBAL fabric', 2], ['Nomex', 1]])
    const { container } = render(<MaterialsCard rows={parsed} />)
    const items = [...container.querySelectorAll('[data-material]')]
    expect(items.map((li) => li.textContent)).toEqual(['PMMA3', 'SIBAL fabric2', 'Nomex1'])
    expect((items[0].querySelector('span > span') as HTMLElement).style.width).toBe('100%')
  })

  it('shows the scorecard from scorecard.json: matched, not matched, and not scorable', () => {
    const { container } = render(<ScorecardCard total={129} />)
    const text = container.textContent!.replace(/\s+/g, ' ')
    expect(text).toContain(`${scorecard.matched}of ${scorecard.scored} scored tests match NASA`)
    expect(text).toContain(`Match${scorecard.matchedTests.join(', ')}`)
    expect(text).toContain(`No match${scorecard.scored - scorecard.matched} tests`)
    expect(text).toContain('Not scored103 tests: NASA states no outcome for them')
  })

  it('folds the developer cards into "About this dataset", closed by default', () => {
    const { container } = render(<AboutDataset><p id="dev-card">Columns 35</p></AboutDataset>)
    const details = container.querySelector('details#about-dataset') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details.querySelector('summary')?.textContent).toMatch(/^About this dataset/)
    expect(details.querySelector('#dev-card')).toBeTruthy()
  })
})
