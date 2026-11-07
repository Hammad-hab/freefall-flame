'use client'

/**
 * The layout bar above the Investigations widgets: one chip per widget.
 *   - Click (or Enter / Space) a chip: show or hide its widget.
 *   - Drag a chip by its handle (pointer events: mouse, touch and pen) to
 *     reorder; the chips move as you drag.
 *   - Keyboard: Alt+Left / Alt+Right on a chip moves it one place; a screen
 *     reader hears where it went.
 *   - "Reset layout" restores the default (everything shown, open, in order).
 * No drag-and-drop library: the browser's own drag events don't work on phones.
 */
import { useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent } from 'react'
import { WIDGET_INFO, isDefaultLayout, widgetLayoutReducer, type WidgetAction, type WidgetId, type WidgetLayout } from '@/lib/widget-layout'
import { C } from '../ui/chart-theme'

interface Drag { id: WidgetId; to: number; pointerId: number }

export default function LayoutBar({
  layout,
  dispatch,
  onShow,
  available,
}: {
  layout: WidgetLayout
  dispatch: Dispatch<WidgetAction>
  /** Widgets the tab can draw (all of them, normally). */
  available?: WidgetId[]
  /** A hidden widget was just shown (the tab scrolls to it). */
  onShow?: (id: WidgetId) => void
}) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const [said, setSaid] = useState('')
  const chips = useRef(new Map<WidgetId, HTMLElement>())

  // While dragging, the chips are drawn in the order they would land in.
  const preview = drag ? widgetLayoutReducer(layout, { type: 'move', id: drag.id, to: drag.to }).order : layout.order
  const order = preview.filter((id) => !available || available.includes(id))
  const n = layout.order.length
  const announce = (id: WidgetId, at: number) => setSaid(`${WIDGET_INFO[id].label} moved to position ${at + 1} of ${n}.`)

  const toggle = (id: WidgetId) => {
    const wasHidden = layout.hidden.includes(id)
    dispatch({ type: 'toggleHidden', id })
    setSaid(`${WIDGET_INFO[id].label} ${wasHidden ? 'shown' : 'hidden'}.`)
    if (wasHidden) onShow?.(id)
  }

  const onKeyDown = (e: KeyboardEvent, id: WidgetId) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    const by = e.key === 'ArrowLeft' ? -1 : 1
    const at = Math.max(0, Math.min(n - 1, layout.order.indexOf(id) + by))
    dispatch({ type: 'moveBy', id, by })
    announce(id, at)
    // Keep the focus on the chip that moved.
    requestAnimationFrame(() => chips.current.get(id)?.querySelector<HTMLButtonElement>('[data-chip-toggle]')?.focus())
  }

  // The chip nearest the pointer (distance 0 inside it) is where the dragged
  // one goes: its place in the (previewed) order.
  const targetAt = (x: number, y: number): number | null => {
    let best: WidgetId | null = null
    let bestD = Infinity
    for (const id of order) {
      const r = chips.current.get(id)?.getBoundingClientRect()
      if (!r) continue
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
      const d = Math.hypot(dx, dy)
      if (d < bestD) { bestD = d; best = id }
    }
    return best === null ? null : preview.indexOf(best)
  }

  const startDrag = (e: PointerEvent<HTMLSpanElement>, id: WidgetId) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId) // keeps the drag when the pointer leaves the handle
    setDrag({ id, to: layout.order.indexOf(id), pointerId: e.pointerId })
  }
  const moveDrag = (e: PointerEvent<HTMLSpanElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const k = targetAt(e.clientX, e.clientY)
    if (k !== null && k !== drag.to) setDrag({ ...drag, to: k })
  }
  const endDrag = (e: PointerEvent<HTMLSpanElement>, cancel: boolean) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    if (!cancel && drag.to !== layout.order.indexOf(drag.id)) {
      dispatch({ type: 'move', id: drag.id, to: drag.to })
      announce(drag.id, drag.to)
    }
    setDrag(null)
  }

  return (
    <div
      id="psi-layout-bar"
      role="toolbar"
      aria-label="Widget layout"
      className="sticky top-0 z-10 -mx-1 flex items-center gap-2 rounded-2xl border px-2 py-2"
      style={{ borderColor: C.line, background: C.ink2 }}
    >
      <span className="hidden shrink-0 pl-1 text-[10px] uppercase tracking-wider @3xl:inline" style={{ color: C.muted }}>Layout</span>
      <ul className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto @5xl:flex-wrap @5xl:overflow-visible" data-chips>
        {order.map((id) => {
          const shown = !layout.hidden.includes(id)
          const dragging = drag?.id === id
          const { label } = WIDGET_INFO[id]
          return (
            <li
              key={id}
              ref={(el) => { if (el) chips.current.set(id, el); else chips.current.delete(id) }}
              data-chip={id}
              data-shown={shown || undefined}
              className="flex shrink-0 items-center overflow-hidden rounded-full border text-[11px] transition-colors pointer-coarse:min-h-11"
              style={{
                borderColor: shown ? C.amber : C.line,
                background: shown ? C.chip2 : C.ink,
                color: shown ? C.fg : C.muted,
                opacity: dragging ? 0.7 : 1,
                boxShadow: dragging ? `0 0 0 2px ${C.amber}` : undefined,
              }}
            >
              <span
                role="presentation"
                aria-hidden="true"
                title={`Drag to move ${label}`}
                data-chip-handle={id}
                onPointerDown={(e) => startDrag(e, id)}
                onPointerMove={moveDrag}
                onPointerUp={(e) => endDrag(e, false)}
                onPointerCancel={(e) => endDrag(e, true)}
                className="grid h-full cursor-grab touch-none select-none place-items-center self-stretch pl-2.5 pr-1 active:cursor-grabbing pointer-coarse:px-3"
                style={{ color: C.muted }}
              >
                ⠿
              </span>
              <button
                type="button"
                data-chip-toggle={id}
                aria-pressed={shown}
                aria-describedby="psi-layout-help"
                onClick={() => toggle(id)}
                onKeyDown={(e) => onKeyDown(e, id)}
                className="h-full py-1.5 pl-1 pr-3 text-left"
                style={{ textDecoration: shown ? undefined : 'line-through' }}
              >
                <span className="sr-only">{`${preview.indexOf(id) + 1}. `}</span>
                {label}
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        data-layout-reset
        onClick={() => { dispatch({ type: 'reset' }); setSaid('Layout reset: every widget shown and open, in the first order.') }}
        disabled={isDefaultLayout(layout)}
        className="shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition-colors hover:brightness-110 disabled:opacity-40 pointer-coarse:min-h-11"
        style={{ borderColor: C.line, background: C.surface, color: C.fg }}
      >
        Reset layout
      </button>
      <span id="psi-layout-help" className="sr-only">
        Press Enter to show or hide this widget. Alt plus Left or Right arrow moves it. Or drag its handle.
      </span>
      <span role="status" aria-live="polite" className="sr-only" data-layout-said>{said}</span>
    </div>
  )
}
