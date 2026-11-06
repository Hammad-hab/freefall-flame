/**
 * feat/polish: the dashboard loader's error handling, the outcome and
 * rod-diameter chart data, the Overview's fire-safety numbers, the assistant
 * (answer first, "Read more" for the observations), and the friendly page.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { loadDashboard, type DashboardFetchers } from '@/app/(frontend)/dashboard/load'
import { isNotFoundOrForbidden } from '@/lib/errors'
import { outcomeCounts, rodDiameterDistribution } from '@/app/(frontend)/dashboard/components/visualization/chartData'
import KeyNumbers from '@/app/(frontend)/dashboard/components/overview/KeyNumbers'
import { Assistant } from '@/app/(frontend)/dashboard/components/overview/Fragments'
import { DataUnavailable } from '@/app/(frontend)/dashboard/components/ui/DataUnavailable'
import { buildRowMapping, parseRows, resolveBass2Columns } from '@/lib/combustion'
import type { DatasetMeta, DataRow } from '@/lib/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ds = (id: number, name: string): DatasetMeta => ({ id, name, description: null, columns: [], rowCount: 0, lastImportedAt: null, papers: [] })
const fetchers = (over: Partial<DashboardFetchers> = {}): DashboardFetchers => ({
  published: async () => [ds(4, 'BASS-II (cleaned)')],
  publishedUncached: async () => [ds(4, 'BASS-II (cleaned)')],
  dataset: async (id) => (id === '4' ? ds(4, 'BASS-II (cleaned)') : null),
  rows: async () => [],
  ...over,
})

describe('dashboard loader', () => {
  it('loads the default dataset', async () => {
    const r = await loadDashboard(undefined, fetchers())
    expect(r.kind).toBe('ok')
    expect(r.kind === 'ok' && r.datasetId).toBe('4')
  })

  it('says "not found" for a bad id before any database call', async () => {
    const f = fetchers({ published: vi.fn(), dataset: vi.fn() })
    expect((await loadDashboard('abc', f)).kind).toBe('notFound')
    expect(f.published).not.toHaveBeenCalled()
    expect(f.dataset).not.toHaveBeenCalled()
  })

  it('says "not found" for an unknown or unpublished id', async () => {
    expect((await loadDashboard('2', fetchers())).kind).toBe('notFound')
  })

  it('gives the friendly page, not a crash, when the database can\'t be reached', async () => {
    const down = new Error('getaddrinfo EAI_AGAIN db.example')
    for (const over of [
      { published: async () => { throw down } },
      { dataset: async () => { throw down } },
      { rows: async () => { throw down } },
    ] as Partial<DashboardFetchers>[]) {
      const r = await loadDashboard(undefined, fetchers(over))
      expect(r.kind).toBe('unavailable')
    }
  })

  it('tells "not found" (404/403) apart from "can\'t reach the database"', () => {
    expect(isNotFoundOrForbidden({ status: 404 })).toBe(true)
    expect(isNotFoundOrForbidden({ status: 403 })).toBe(true)
    expect(isNotFoundOrForbidden(new Error('connect ECONNREFUSED'))).toBe(false)
    expect(isNotFoundOrForbidden(null)).toBe(false)
  })
})

// A few rows shaped like the cleaned BASS-II dataset.
const columns = [
  { key: 'test_no', label: 'Test No.', type: 'text' },
  { key: 'material', label: 'Material', type: 'category', canonicalField: 'material' },
  { key: 'outcome', label: 'Outcome', type: 'category', canonicalField: 'outcome' },
  { key: 'thickness', label: 'Thickness', type: 'number', unit: 'mm' },
  { key: 'rod_diameter_mm', label: 'Rod diameter', type: 'number', unit: 'mm' },
] as DatasetMeta['columns']
const base = { _id: 1, _index: 1, _paper: null, _page: null }
const rows: DataRow[] = [
  { ...base, test_no: 'B14', material: 'PMMA', outcome: 'extinguished_low_flow', thickness: 0.2, rod_diameter_mm: null },
  { ...base, test_no: 'B18', material: 'PMMA', outcome: 'blowoff_high_flow', thickness: 0.2, rod_diameter_mm: null },
  { ...base, test_no: 'P5', material: 'PMMA', outcome: 'not_stated', thickness: null, rod_diameter_mm: 12.7 },
  { ...base, test_no: 'P6', material: 'PMMA', outcome: 'not_stated', thickness: null, rod_diameter_mm: 6.35 },
  { ...base, test_no: 'S1', material: 'SIBAL fabric', outcome: 'not_stated', thickness: 0.37, rod_diameter_mm: null },
]
const parsed = parseRows(rows, buildRowMapping(resolveBass2Columns(columns).resolutions))

describe('charts and numbers from the clean data', () => {
  it('counts all five outcome codes, zeros kept', () => {
    expect(outcomeCounts(parsed).map((o) => `${o.code} ${o.value}`)).toEqual([
      'not_stated 3', 'extinguished_low_flow 1', 'blowoff_high_flow 1', 'no_ignition 0', 'not_sustained 0',
    ])
    expect(outcomeCounts(parseRows(rows, buildRowMapping(resolveBass2Columns(columns.filter((c) => c.key !== 'outcome')).resolutions)))).toEqual([])
  })

  it('charts rods by diameter, which have no thickness', () => {
    expect(rodDiameterDistribution(parsed)).toEqual([{ name: '6.35 mm', value: 1 }, { name: '12.7 mm', value: 1 }])
  })

  it('shows real fire-safety numbers on the Overview, not template text', () => {
    render(<KeyNumbers rows={parsed} />)
    const box = document.querySelector('#key-numbers')!.textContent!
    expect(box).toContain('PMMA 4 · SIBAL fabric 1')
    expect(box).toContain('2 of 5 tests: 1 went out at low flow · 1 blew off at high flow')
    expect(box).toContain('4 of 26 scored tests match NASA (B14, B18, B19, O4)')
    expect(box).toContain('BASS-II, score 90 of 100')
    expect(box).not.toMatch(/encryption|supplier|thread|priority/i)
  })
})

describe('Overview assistant', () => {
  it('shows the answer first, in full, and "Read more" only for the observations', async () => {
    const longAnswer = 'Answer sentence. '.repeat(40).trim()
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({
        fallback: { observations: ['First observation.', 'Second observation.', 'Third observation.'], interpretations: ['An interpretation.'], uncertainties: ['An uncertainty.'] },
        allMaterials: ['PMMA'],
        answer: url.includes('question=') ? longAnswer : null,
        answerModel: 'openai/gpt-4o-mini',
      }),
    })))
    render(<Assistant datasetId="4" datasetName="BASS-II (cleaned)" />)
    await screen.findByText('First observation.')
    expect(screen.queryByText('Second observation.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Read more/ }))
    expect(screen.getByText('Third observation.')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Ask about this dataset…'), { target: { value: 'What burned?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    await waitFor(() => expect(document.querySelector('#assistant-answer')?.textContent).toBe(longAnswer))
    const answer = document.querySelector('#assistant-answer')!
    const obs = document.querySelector('#assistant-observations')!
    expect(answer.compareDocumentPosition(obs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('friendly error page', () => {
  it('says the data could not be reached and offers to try again', () => {
    const retry = vi.fn()
    render(<DataUnavailable onRetry={retry} />)
    expect(screen.getByRole('heading').textContent).toBe("Couldn't reach the data, try again")
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalled()
  })
})
