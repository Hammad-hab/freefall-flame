/**
 * feat/psi-widgets: the Investigations tab as widgets. The layout reducer
 * (src/lib/widget-layout.ts), a saved layout that is broken or missing, and
 * the widgets on screen: collapse, close, and the layout kept in storage.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import {
  DEFAULT_LAYOUT,
  LAYOUT_KEY,
  WIDGETS,
  isDefaultLayout,
  layoutRows,
  parseLayout,
  widgetLayoutReducer as reduce,
  type WidgetLayout,
} from '@/lib/widget-layout'
import Investigations from '@/app/(frontend)/dashboard/components/investigations/Investigations'

afterEach(cleanup)
beforeEach(() => { try { window.localStorage.clear() } catch { /* none */ } })

const D: WidgetLayout = DEFAULT_LAYOUT

describe('widget layout reducer', () => {
  it('starts with every widget shown and open, Ranking and Weights first and side by side', () => {
    expect(D.order).toEqual(['ranking', 'weights', 'ai', 'simulated', 'cards', 'moon', 'assumptions'])
    expect(D.hidden).toEqual([])
    expect(D.collapsed).toEqual([])
    expect(layoutRows(D)[0]).toEqual(['ranking', 'weights'])
    expect(layoutRows(D).slice(1).every((r) => r.length === 1)).toBe(true)
  })

  it('hides, shows, collapses and opens', () => {
    let s = reduce(D, { type: 'toggleHidden', id: 'ai' })
    expect(s.hidden).toEqual(['ai'])
    expect(layoutRows(s).flat()).not.toContain('ai')
    s = reduce(s, { type: 'toggleHidden', id: 'ai' })
    expect(s.hidden).toEqual([])
    s = reduce(s, { type: 'toggleCollapsed', id: 'cards' })
    expect(s.collapsed).toEqual(['cards'])
    expect(layoutRows(s).flat()).toContain('cards') // collapsed is still shown
    expect(reduce(s, { type: 'toggleCollapsed', id: 'cards' }).collapsed).toEqual([])
    expect(reduce(reduce(D, { type: 'hide', id: 'moon' }), { type: 'hide', id: 'moon' }).hidden).toEqual(['moon'])
  })

  it('moves a widget to a place, or by steps, clamped at the ends', () => {
    expect(reduce(D, { type: 'move', id: 'assumptions', to: 0 }).order[0]).toBe('assumptions')
    expect(reduce(D, { type: 'moveBy', id: 'ranking', by: 1 }).order.slice(0, 2)).toEqual(['weights', 'ranking'])
    expect(reduce(D, { type: 'moveBy', id: 'ranking', by: -1 })).toBe(D) // already first: unchanged
    expect(reduce(D, { type: 'move', id: 'ranking', to: 99 }).order.at(-1)).toBe('ranking')
    const s = reduce(D, { type: 'moveBy', id: 'cards', by: -2 })
    expect(s.order).toEqual(['ranking', 'weights', 'cards', 'ai', 'simulated', 'moon', 'assumptions'])
    expect([...s.order].sort()).toEqual([...WIDGETS].sort())
  })

  it('pairs half-width widgets only when they are next to each other', () => {
    const apart = reduce(D, { type: 'move', id: 'weights', to: 3 })
    expect(layoutRows(apart).every((r) => r.length === 1)).toBe(true)
    const hiddenBetween = reduce(reduce(D, { type: 'move', id: 'weights', to: 2 }), { type: 'hide', id: 'ai' })
    expect(layoutRows(hiddenBetween)[0]).toEqual(['ranking', 'weights'])
  })

  it('reveals a widget a link points into, and resets', () => {
    const s = reduce(reduce(D, { type: 'hide', id: 'cards' }), { type: 'toggleCollapsed', id: 'cards' })
    const r = reduce(s, { type: 'reveal', id: 'cards' })
    expect(r.hidden).toEqual([])
    expect(r.collapsed).toEqual([])
    expect(isDefaultLayout(reduce(reduce(D, { type: 'move', id: 'moon', to: 0 }), { type: 'reset' }))).toBe(true)
  })

  it('makes a saved layout safe: broken or missing data gives the default', () => {
    for (const bad of [null, undefined, 'x', 42, [], { order: 'nope' }]) expect(parseLayout(bad)).toEqual(D)
    const p = parseLayout({ order: ['moon', 'bogus', 'moon', 'ranking'], hidden: ['ai', 'nope', 'ai'], collapsed: [7, 'cards'] })
    expect(p.order).toEqual(['moon', 'ranking', 'weights', 'ai', 'simulated', 'cards', 'assumptions'])
    expect(p.hidden).toEqual(['ai'])
    expect(p.collapsed).toEqual(['cards'])
    expect(reduce(D, { type: 'load', saved: { order: ['assumptions'] } }).order[0]).toBe('assumptions')
  })
})

describe('widgets on screen', () => {
  it('draws each widget with a header that collapses it and closes it, and keeps the layout', async () => {
    render(<Investigations />)
    const ids = [...document.querySelectorAll('[data-widget]')].map((w) => w.getAttribute('data-widget'))
    expect(ids.slice(0, 2)).toEqual(['ranking', 'weights'])
    expect(ids).toEqual(expect.arrayContaining(['ranking', 'weights', 'ai', 'cards', 'moon', 'assumptions']))

    const collapse = document.querySelector('[data-widget-collapse="ranking"]') as HTMLButtonElement
    expect(collapse.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(collapse)
    expect(collapse.getAttribute('aria-expanded')).toBe('false')
    expect((document.getElementById('psi-w-ranking-body') as HTMLElement).hidden).toBe(true)
    // Collapsed, its header says the top of the ranking in one line.
    expect(document.querySelector('[data-widget="ranking"] [data-widget-summary]')?.textContent).toMatch(/^1\. BASS-II 90/)

    fireEvent.click(document.querySelector('[data-widget-close="moon"]')!)
    expect(document.querySelector('[data-widget="moon"]')).toBeNull()

    await act(async () => {})
    const saved = JSON.parse(window.localStorage.getItem(LAYOUT_KEY)!)
    expect(saved.hidden).toEqual(['moon'])
    expect(saved.collapsed).toEqual(['ranking'])
  })

  it('layout bar: a chip shows and hides its widget, Alt+arrows move it, Reset restores', async () => {
    render(<Investigations />)
    const chipIds = () => [...document.querySelectorAll('[data-chip]')].map((c) => c.getAttribute('data-chip'))
    const widgetIds = () => [...document.querySelectorAll('[data-widget]')].map((w) => w.getAttribute('data-widget'))
    const chip = (id: string) => document.querySelector(`[data-chip-toggle="${id}"]`) as HTMLButtonElement
    const reset = document.querySelector('[data-layout-reset]') as HTMLButtonElement
    expect(reset.disabled).toBe(true)
    expect(chipIds().slice(0, 3)).toEqual(['ranking', 'weights', 'ai'])

    expect(chip('ai').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(chip('ai'))
    expect(chip('ai').getAttribute('aria-pressed')).toBe('false')
    expect(widgetIds()).not.toContain('ai')
    expect(document.querySelector('[data-layout-said]')?.textContent).toBe('AI interpretation hidden.')
    fireEvent.click(chip('ai'))
    expect(widgetIds()).toContain('ai')

    // Keyboard: Alt+Right moves Ranking one place right, and says so.
    fireEvent.keyDown(chip('ranking'), { key: 'ArrowRight', altKey: true })
    expect(chipIds().slice(0, 2)).toEqual(['weights', 'ranking'])
    expect(widgetIds().slice(0, 2)).toEqual(['weights', 'ranking'])
    expect(document.querySelector('[data-layout-said]')?.textContent).toBe('Ranking moved to position 2 of 7.')
    fireEvent.keyDown(chip('ranking'), { key: 'ArrowRight' }) // without Alt: nothing
    expect(chipIds().slice(0, 2)).toEqual(['weights', 'ranking'])

    expect(reset.disabled).toBe(false)
    fireEvent.click(reset)
    expect(chipIds().slice(0, 2)).toEqual(['ranking', 'weights'])
    expect(reset.disabled).toBe(true)
  })

  it('compact cards: name, score and rank, three facts, and Details in a side panel (Esc closes, focus returns)', () => {
    render(<Investigations />)
    const card = document.querySelector('[data-psi="bass-ii"]') as HTMLElement
    expect(card.querySelector('h4')?.textContent).toBe('BASS-II')
    expect(card.querySelector('[data-card-score]')?.textContent).toBe('90')
    expect(card.querySelector('[data-card-rank]')?.textContent).toBe('rank 1')
    const text = card.textContent!.replace(/\s+/g, ' ')
    expect(text).toContain('What was burned')
    expect(text).toContain('Oxygen13.6-22.2 %')
    expect(text).toContain('Tests129 (per test)')
    // Only the key facts on the compact card: no sources, no criteria.
    expect(text).not.toContain('NASA PSI table')
    expect(card.querySelector('[data-criteria]')).toBeNull()

    const details = card.querySelector('[data-details]') as HTMLButtonElement
    details.focus()
    fireEvent.click(details)
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('psi-detail-bass-ii-title')
    expect(document.getElementById('psi-detail-bass-ii-title')?.textContent).toBe('BASS-II')
    expect(dialog.querySelector('[data-criteria]')).toBeTruthy()
    expect(dialog.querySelector('[data-sources]')).toBeTruthy()
    expect(dialog.querySelector('[data-explain="bass-ii"]')).toBeTruthy()
    expect(document.activeElement?.hasAttribute('data-drawer-close')).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(details)
  })

  it('a ranking row shows its card, even with the cards widget closed or filtered, and opens its details', async () => {
    render(<Investigations />)
    fireEvent.click(document.querySelector('[data-widget-close="cards"]')!)
    fireEvent.change(document.querySelector('[data-filter="phase"]') ?? document.createElement('select'), { target: { value: 'gas' } })
    fireEvent.click(document.querySelector('[data-rank-id="flex"] button')!)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(document.querySelector('[data-widget="cards"]')).toBeTruthy()
    expect(document.querySelector('[data-psi="flex"][data-focused]')).toBeTruthy()
    expect(document.querySelector('[data-psi-detail="flex"]')).toBeTruthy()
  })

  it('filters cards by phase and sorts them, saying how many show', () => {
    render(<Investigations />)
    const ids = () => [...document.querySelectorAll('[data-psi]')].map((c) => c.getAttribute('data-psi'))
    expect(ids()).toHaveLength(14)
    expect(ids()[0]).toBe('bass-ii') // by score
    fireEvent.change(document.querySelector('[data-filter="phase"]')!, { target: { value: 'solid' } })
    expect(ids()).toEqual(['bass-ii', 'saffire-i-iii', 'bass'])
    expect(document.querySelector('[data-card-count]')?.textContent).toBe('Showing 3 of 14')
    fireEvent.change(document.querySelector('[data-filter="phase"]')!, { target: { value: 'all' } })
    fireEvent.change(document.querySelector('[data-sort]')!, { target: { value: 'tests' } })
    expect(ids()[0]).toBe('spice') // 469 tests, the most
    fireEvent.change(document.querySelector('[data-sort]')!, { target: { value: 'name' } })
    expect(ids()[0]).toBe('bass')
  })

  it('reads the saved layout back, and still works when storage is broken', () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ order: ['assumptions'], hidden: ['ai'], collapsed: [] }))
    render(<Investigations />)
    const ids = [...document.querySelectorAll('[data-widget]')].map((w) => w.getAttribute('data-widget'))
    expect(ids[0]).toBe('assumptions')
    expect(ids).not.toContain('ai')
    cleanup()

    window.localStorage.setItem(LAYOUT_KEY, '{not json')
    render(<Investigations />)
    expect(document.querySelectorAll('[data-widget]').length).toBeGreaterThanOrEqual(6)
  })
})
