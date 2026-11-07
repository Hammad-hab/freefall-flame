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
