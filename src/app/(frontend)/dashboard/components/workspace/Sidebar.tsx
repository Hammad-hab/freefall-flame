'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { TabId } from './layout-reducer'
import { TAB_REGISTRY, TAB_ORDER } from './tabs'
import { Icon } from '../ui/Card'

interface SidebarProps {
  activeTab: TabId | null
  canSplit: boolean
  onOpenTab: (tab: TabId) => void
  onSplitRight: (tab: TabId) => void
}

/** Below this window width the sidebar starts collapsed and opens over the content. */
const NARROW_PX = 768

export default function Sidebar({ activeTab, canSplit, onOpenTab, onSplitRight }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [narrow, setNarrow] = useState(false)

  // On a phone-width window the sidebar collapses to a thin strip, so the
  // canvas and cards get the width; it follows the window as it is resized.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(`(max-width: ${NARROW_PX - 1}px)`)
    const apply = () => {
      setNarrow(mq.matches)
      setCollapsed(mq.matches)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-r border-line bg-ink py-2" data-sidebar="collapsed">
        <button
          aria-label={narrow ? 'Open menu' : 'Expand sidebar'}
          onClick={() => setCollapsed(false)}
          className="rounded p-1.5 text-muted transition-colors hover:bg-line hover:text-fg"
        >
          <Icon d={narrow ? 'M4 6h16M4 12h16M4 18h16' : 'M9 6l6 6-6 6'} className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // Narrow window, menu open: it lies over the content (with a backdrop that
  // closes it), and picking a tab closes it again.
  const pick = (tab: TabId) => {
    onOpenTab(tab)
    if (narrow) setCollapsed(true)
  }
  const panel = (
    <div
      className={`flex w-48 shrink-0 flex-col border-r border-line bg-ink ${narrow ? 'fixed inset-y-0 left-0 z-40 w-56 shadow-2xl' : ''}`}
      data-sidebar={narrow ? 'overlay' : 'open'}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <Link
          href="/"
          className="text-[13px] font-semibold text-fg transition-colors hover:text-flame-blue"
        >
          Flame in Freefall
        </Link>
        <button
          aria-label="Collapse sidebar"
          onClick={() => setCollapsed(true)}
          className="rounded p-1 text-muted transition-colors hover:bg-line hover:text-fg"
        >
          <Icon d="M15 6l-6 6 6 6" className="h-3.5 w-3.5" />
        </button>
      </div>
      <nav aria-label="Dashboard tabs" className="flex-1 overflow-y-auto py-1">
        {TAB_ORDER.map((tab) => {
          const meta = TAB_REGISTRY[tab]
          const isActive = tab === activeTab
          return (
            <div
              key={tab}
              className={`group flex items-center gap-2 px-3 py-1.5 text-[12px] transition-colors ${
                isActive ? 'bg-line text-fg' : 'text-muted hover:bg-line/50 hover:text-fg'
              }`}
            >
              <button
                onClick={() => pick(tab)}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <Icon d={meta.icon} className="h-3.5 w-3.5 shrink-0" />
                {meta.label}
              </button>
              <button
                aria-label={`Split right: ${meta.label}`}
                title={canSplit ? `Open ${meta.label} in a new pane` : 'Maximum panes reached'}
                disabled={!canSplit}
                onClick={() => onSplitRight(tab)}
                className="rounded p-0.5 text-muted opacity-0 transition-all hover:bg-line hover:text-fg focus:opacity-100 group-hover:opacity-100 disabled:opacity-30"
              >
                <Icon d="M4 4h16v16H4zM12 4v16" className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </nav>
    </div>
  )
  if (!narrow) return panel
  return (
    <>
      {/* The strip keeps its place in the layout; the open menu lies over the content. */}
      <div className="w-10 shrink-0 border-r border-line bg-ink" />
      <button aria-label="Close menu" onClick={() => setCollapsed(true)} className="fixed inset-0 z-30 bg-black/50" />
      {panel}
    </>
  )
}
