/**
 * The Investigations tab's widget layout: which widgets show, in what order,
 * and which are collapsed. A pure reducer (no React, no storage) like
 * workspace/layout-reducer.ts, so it can be unit-tested on its own; the tab
 * keeps the state in the viewer's browser (localStorage, when available).
 */

export const WIDGETS = ['ranking', 'weights', 'ai', 'simulated', 'cards', 'moon', 'assumptions'] as const
export type WidgetId = (typeof WIDGETS)[number]

export const WIDGET_INFO: Record<WidgetId, { label: string; title: string; half?: boolean }> = {
  ranking: { label: 'Ranking', title: 'Ranking: habitat fire-safety relevance', half: true },
  weights: { label: 'Weights', title: 'Weights', half: true },
  ai: { label: 'AI interpretation', title: 'AI interpretation of the ranking' },
  simulated: { label: 'What we simulated', title: 'What we simulated, and why' },
  cards: { label: 'Investigation cards', title: 'Investigation cards' },
  moon: { label: 'Moon-base scenario', title: 'Moon-base scenario (extrapolation)' },
  assumptions: { label: 'Stated assumptions', title: 'Stated assumptions' },
}

export interface WidgetLayout {
  order: WidgetId[]
  hidden: WidgetId[]
  collapsed: WidgetId[]
}

/** Everything shown and open; Ranking and Weights first, side by side. */
export const DEFAULT_LAYOUT: WidgetLayout = { order: [...WIDGETS], hidden: [], collapsed: [] }

export const LAYOUT_KEY = 'psi-layout-v1'

export type WidgetAction =
  | { type: 'toggleHidden'; id: WidgetId }
  | { type: 'hide'; id: WidgetId }
  | { type: 'toggleCollapsed'; id: WidgetId }
  /** Move a widget to a position in the order (clamped to the ends). */
  | { type: 'move'; id: WidgetId; to: number }
  /** Move a widget one or more places left (negative) or right. */
  | { type: 'moveBy'; id: WidgetId; by: number }
  /** Show and open a widget (a link points into it). */
  | { type: 'reveal'; id: WidgetId }
  | { type: 'reset' }
  /** Replace the layout with a saved one (made safe by parseLayout). */
  | { type: 'load'; saved: unknown }

const without = (list: WidgetId[], id: WidgetId) => list.filter((x) => x !== id)
const withOne = (list: WidgetId[], id: WidgetId) => (list.includes(id) ? list : [...list, id])

export function widgetLayoutReducer(state: WidgetLayout, action: WidgetAction): WidgetLayout {
  switch (action.type) {
    case 'toggleHidden':
      return { ...state, hidden: state.hidden.includes(action.id) ? without(state.hidden, action.id) : withOne(state.hidden, action.id) }
    case 'hide':
      return { ...state, hidden: withOne(state.hidden, action.id) }
    case 'toggleCollapsed':
      return { ...state, collapsed: state.collapsed.includes(action.id) ? without(state.collapsed, action.id) : withOne(state.collapsed, action.id) }
    case 'move': {
      const from = state.order.indexOf(action.id)
      if (from < 0) return state
      const rest = without(state.order, action.id)
      const to = Math.max(0, Math.min(rest.length, Math.round(action.to)))
      if (to === from) return state
      return { ...state, order: [...rest.slice(0, to), action.id, ...rest.slice(to)] }
    }
    case 'moveBy':
      return widgetLayoutReducer(state, { type: 'move', id: action.id, to: state.order.indexOf(action.id) + action.by })
    case 'reveal':
      if (!state.hidden.includes(action.id) && !state.collapsed.includes(action.id)) return state
      return { ...state, hidden: without(state.hidden, action.id), collapsed: without(state.collapsed, action.id) }
    case 'reset':
      return { order: [...DEFAULT_LAYOUT.order], hidden: [], collapsed: [] }
    case 'load':
      return parseLayout(action.saved)
  }
}

const isWidget = (x: unknown): x is WidgetId => typeof x === 'string' && (WIDGETS as readonly string[]).includes(x)
const known = (x: unknown): WidgetId[] => (Array.isArray(x) ? [...new Set(x.filter(isWidget))] : [])

/**
 * A saved layout, made safe: unknown ids and repeats dropped, widgets missing
 * from the order added at the end (so a widget added later still shows).
 * Anything that isn't a layout gives the default.
 */
export function parseLayout(raw: unknown): WidgetLayout {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LAYOUT, order: [...DEFAULT_LAYOUT.order] }
  const r = raw as Record<string, unknown>
  const order = known(r.order)
  for (const w of WIDGETS) if (!order.includes(w)) order.push(w)
  return { order, hidden: known(r.hidden), collapsed: known(r.collapsed) }
}

export const isDefaultLayout = (s: WidgetLayout) =>
  s.hidden.length === 0 && s.collapsed.length === 0 && s.order.every((w, k) => w === DEFAULT_LAYOUT.order[k])

/**
 * The shown widgets in rows: two half-width widgets next to each other in the
 * order share a row; everything else gets a row of its own.
 */
export function layoutRows(state: WidgetLayout): WidgetId[][] {
  const shown = state.order.filter((w) => !state.hidden.includes(w))
  const rows: WidgetId[][] = []
  for (let k = 0; k < shown.length; k++) {
    const a = shown[k], b = shown[k + 1]
    if (WIDGET_INFO[a].half && b && WIDGET_INFO[b].half) { rows.push([a, b]); k++ }
    else rows.push([a])
  }
  return rows
}
