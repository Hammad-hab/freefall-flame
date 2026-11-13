/**
 * feat/ui-review: AI answers render as Markdown (headings, bold, lists) in
 * every AI panel, safely: no HTML from the model ever becomes an element.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import Markdown, { parseBlocks } from '@/app/(frontend)/dashboard/components/ui/Markdown'
import AiSummary from '@/app/(frontend)/dashboard/components/investigations/AiSummary'
import { Assistant } from '@/app/(frontend)/dashboard/components/overview/Fragments'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// The overall answer from the feat/psi-widgets review (8 Nov 2026), as the model wrote it.
const REVIEW_ANSWER = `### Top of the ranking
1. **BASS-II** (PSI-25) - 129 tests; oxygen range: 13.6-22.2%; outcomes recorded: partial (26 of 129).
2. **Saffire I-III** (PSI-98/99/100) - 13 tests; oxygen range: 21.5-22.1%; outcomes recorded: yes (burn time, spread).
2. **SAME-R** (PSI-101) - 109 tests; oxygen range: 21 (air); outcomes recorded: no.

### What separates them
The top three have criterion scores of 2 in habitat materials, cabin airflow, and informs a fire-safety decision, while the rest do not. This suggests BASS-II's extensive data and outcomes contribute significantly to fire safety considerations.

### What the tables can't tell us
10 tables report no outcome per test: BASS, FLEX-2, CFI, Flame Design (ACME), BRE (ACME), CLD Flame (ACME), s-Flame (ACME), SPICE, SAME-R, SAME.`

describe('Markdown for AI answers', () => {
  it('renders headings, bold and numbered lists (keeping the model\'s own numbers, ties included)', () => {
    const { container } = render(<Markdown text={REVIEW_ANSWER} />)
    expect([...container.querySelectorAll('h4')].map((h) => h.textContent)).toEqual([
      'Top of the ranking', 'What separates them', "What the tables can't tell us",
    ])
    expect([...container.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['BASS-II', 'Saffire I-III', 'SAME-R'])
    const items = [...container.querySelectorAll('li')].map((li) => li.textContent)
    expect(items[0]).toMatch(/^1\.BASS-II \(PSI-25\)/)
    expect(items[1]).toMatch(/^2\.Saffire I-III/)
    expect(items[2]).toMatch(/^2\.SAME-R/) // a tie stays "2.", not renumbered "3."
    expect(container.textContent).not.toMatch(/###|\*\*/)
  })

  it('renders bullets, "2=" ranks, italics and code, and keeps line breaks in a paragraph', () => {
    const { container } = render(<Markdown text={'- one\n* two\n\n2= tied entry\n\nplain *soft* and `code`\nnext line'} />)
    expect([...container.querySelectorAll('ul.list-disc li')].map((li) => li.textContent)).toEqual(['one', 'two'])
    expect(container.textContent).toContain('2=tied entry')
    expect(container.querySelector('em')?.textContent).toBe('soft')
    expect(container.querySelector('code')?.textContent).toBe('code')
    expect(container.querySelector('p br')).toBeTruthy()
  })

  it('never turns model text into HTML: tags show as text, links as their words only', () => {
    const evil = '<script>alert(1)</script> <img src=x onerror=alert(2)> **<b>bold</b>** [click](javascript:alert(3))'
    const { container } = render(<Markdown text={evil} />)
    expect(container.querySelector('script, img, b, a')).toBeNull()
    expect(container.textContent).toContain('<script>alert(1)</script>')
    expect(container.textContent).toContain('<img src=x onerror=alert(2)>')
    expect(container.querySelector('strong')?.textContent).toBe('<b>bold</b>')
    expect(container.textContent).toContain('click')
    expect(container.textContent).not.toContain('javascript:')
  })

  it('leaves unmatched marks as they are', () => {
    const { container } = render(<Markdown text={'5 * 3 = 15 and a lone ** star'} />)
    expect(container.textContent).toBe('5 * 3 = 15 and a lone ** star')
    expect(parseBlocks('a\n\n\nb')).toEqual([{ kind: 'para', lines: ['a'] }, { kind: 'para', lines: ['b'] }])
  })

  it('is used by the investigation summaries and the Overview assistant', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('psi-interpretation')
          ? { ai: REVIEW_ANSWER, model: 'openai/gpt-4o-mini', fallback: [] }
          : { fallback: { observations: ['An observation.'], interpretations: [], uncertainties: [] }, allMaterials: [], answer: url.includes('question=') ? '### Short answer\n- **PMMA** was tested most.' : null, answerModel: 'openai/gpt-4o-mini' },
    })))
    render(<AiSummary id="overall" auto title="the ranking" />)
    await waitFor(() => expect(document.querySelector('[data-ai-summary="overall"] h4')?.textContent).toBe('Top of the ranking'))
    cleanup()

    render(<Assistant datasetId="4" datasetName="BASS-II (cleaned)" />)
    await screen.findByText('An observation.')
    fireEvent.change(screen.getByPlaceholderText('Ask about this dataset…'), { target: { value: 'Which material?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    await waitFor(() => expect(document.querySelector('#assistant-answer h4')?.textContent).toBe('Short answer'))
    expect(document.querySelector('#assistant-answer strong')?.textContent).toBe('PMMA')
  })
})
