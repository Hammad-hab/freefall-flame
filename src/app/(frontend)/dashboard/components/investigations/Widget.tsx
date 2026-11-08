'use client'

/**
 * One widget of the Investigations tab: a panel with a header (title, an
 * optional one-line summary shown while collapsed, collapse and close
 * buttons) around its content. The layout (shown, order, collapsed) lives in
 * src/lib/widget-layout.ts; this only draws one widget.
 */
import type { ReactNode } from 'react'
import { WIDGET_INFO, type WidgetId } from '@/lib/widget-layout'
import { C, alpha, panelCls, panelStyle } from '../ui/chart-theme'

const iconBtn =
  'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[12px] leading-none transition-colors hover:brightness-110'

export default function Widget({
  id,
  collapsed,
  onToggleCollapsed,
  onClose,
  summary,
  actions,
  highlight = false,
  children,
}: {
  id: WidgetId
  collapsed: boolean
  onToggleCollapsed: () => void
  onClose: () => void
  /** One line shown in the header while the widget is collapsed. */
  summary?: ReactNode
  /** Controls in the header, beside the title (shown while open). */
  actions?: ReactNode
  /** Border in the accent colour (the Moon-base extrapolation). */
  highlight?: boolean
  children: ReactNode
}) {
  const { title } = WIDGET_INFO[id]
  const bodyId = `psi-w-${id}-body`
  return (
    <section
      id={`psi-w-${id}`}
      data-widget={id}
      data-collapsed={collapsed || undefined}
      aria-label={title}
      className={`${panelCls} min-w-0 scroll-mt-16`}
      style={highlight ? { ...panelStyle, borderColor: alpha(C.amber, 0x66) } : panelStyle}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="min-w-0 text-[14px] font-medium" style={{ color: C.fg }}>{title}</h3>
        {collapsed && summary && (
          <span data-widget-summary className="min-w-0 flex-1 truncate text-[11px]" style={{ color: C.muted }}>{summary}</span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {!collapsed && actions}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            aria-label={`${collapsed ? 'Open' : 'Collapse'} ${title}`}
            title={collapsed ? 'Open' : 'Collapse'}
            data-widget-collapse={id}
            className={iconBtn}
            style={{ borderColor: C.line, background: C.surface, color: C.fg }}
          >
            {collapsed ? '▸' : '▾'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            title="Close (the chip in the layout bar shows it again)"
            data-widget-close={id}
            className={iconBtn}
            style={{ borderColor: C.line, background: C.surface, color: C.fg }}
          >
            ×
          </button>
        </span>
      </header>
      <div id={bodyId} hidden={collapsed} className="mt-3">
        {children}
      </div>
    </section>
  )
}
