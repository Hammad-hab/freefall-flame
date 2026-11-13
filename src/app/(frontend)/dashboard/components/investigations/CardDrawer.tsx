'use client'

/**
 * The Details side panel: the full card of one investigation (sources, facts
 * from the cleaned table, habitat relevance, links, Explain). A dialog: 480 px
 * on the right of a wide screen, the whole screen on a phone. Esc, the close
 * button or a click outside closes it; Tab stays inside it; focus goes back
 * to the button that opened it.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { C } from '../ui/chart-theme'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function CardDrawer({
  id,
  name,
  opener,
  onClose,
  children,
}: {
  id: string
  name: string
  /** The element to give the focus back to on close. */
  opener: HTMLElement | null
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // Back to the button that opened it, if it is still on the page.
      if (opener && opener.isConnected) opener.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return createPortal(
    <div className="fixed inset-0 z-50" data-drawer-root>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} data-drawer-backdrop aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`psi-detail-${id}-title`}
        id="psi-drawer"
        data-drawer={id}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l sm:w-[480px]"
        style={{ borderColor: C.line, background: C.ink2 }}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: C.line }}>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>Investigation details</span>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            aria-label={`Close the details of ${name}`}
            data-drawer-close
            className="grid h-8 w-8 place-items-center rounded-full border text-[14px] leading-none transition-colors hover:brightness-110"
            style={{ borderColor: C.line, background: C.surface, color: C.fg }}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
