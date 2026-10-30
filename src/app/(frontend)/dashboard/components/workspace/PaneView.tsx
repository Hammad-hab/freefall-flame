'use client'

import { useState, type Dispatch, type KeyboardEvent, type DragEvent } from 'react'
import type { LayoutAction, LeafNode, NodeId, TabId } from './layout-reducer'
import type { TabData } from './tabs'
import { TAB_REGISTRY } from './tabs'
import { Icon } from '../ui/Card'

export interface DragState {
  fromPane: NodeId
  tab: TabId
}

interface PaneViewProps {
  node: LeafNode
  data: TabData
  focused: boolean
  canSplit: boolean
  dispatch: Dispatch<LayoutAction>
  dragRef: React.MutableRefObject<DragState | null>
}

export default function PaneView({ node, data, focused, canSplit, dispatch, dragRef }: PaneViewProps) {
  const activeTab = node.activeTab
  const [dragOver, setDragOver] = useState(false)

  const handleFocus = () => {
    if (!focused) dispatch({ type: 'focusPane', paneId: node.id })
  }

  const handleTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const tabElements = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    )
    const currentIndex = tabElements.indexOf(document.activeElement as HTMLButtonElement)
    if (currentIndex === -1) return
    e.preventDefault()
    const nextIndex =
      e.key === 'ArrowRight'
        ? (currentIndex + 1) % tabElements.length
        : (currentIndex - 1 + tabElements.length) % tabElements.length
    tabElements[nextIndex]?.focus()
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    // Always allow drops when a drag with data is over this pane
    if (e.dataTransfer.types.includes('text/plain')) {
      const fromId = dragRef.current?.fromPane
      // Don't allow dropping on the source pane
      if (!fromId || fromId !== node.id) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOver(true)
      }
    }
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const fromId = dragRef.current?.fromPane
    const tab = dragRef.current?.tab ?? e.dataTransfer.getData('text/plain')
    if (fromId && fromId !== node.id && tab) {
      dispatch({
        type: 'moveTab',
        fromPane: fromId,
        toPane: node.id,
        tab: tab as TabId,
      })
    }
    dragRef.current = null
  }

  if (node.tabs.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center p-8 text-center"
        onClick={handleFocus}
        onFocus={handleFocus}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="text-sm text-muted">Open a tab from the sidebar.</p>
      </div>
    )
  }

  return (
    <div
      className={`flex h-full flex-col min-h-0 min-w-0 ${
        focused ? 'ring-1 ring-inset ring-flame-amber/40' : ''
      } ${dragOver ? 'ring-2 ring-inset ring-flame-amber' : ''}`}
      onClick={handleFocus}
      onFocus={handleFocus}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Pane tabs"
        onKeyDown={handleTabKeyDown}
        className={`flex items-center gap-0.5 border-b border-line px-1.5 py-1 ${
          focused ? 'bg-ink-2' : 'bg-ink'
        }`}
      >
        {node.tabs.map((tab) => {
          const meta = TAB_REGISTRY[tab]
          const isActive = tab === activeTab
          return (
            <div key={tab} className="flex items-center">
              <button
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                draggable
                onDragStart={(e) => {
                  dragRef.current = { fromPane: node.id, tab }
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', tab)
                }}
                onDragEnd={() => {
                  dragRef.current = null
                  setDragOver(false)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'activateTab', paneId: node.id, tab })
                }}
                className={`flex items-center gap-1.5 rounded-t-md px-2.5 py-1.5 text-[12px] transition-colors cursor-grab active:cursor-grabbing ${
                  isActive ? 'bg-panel text-fg' : 'text-muted hover:text-fg'
                }`}
              >
                <Icon d={meta.icon} className="h-3.5 w-3.5 shrink-0" />
                {meta.label}
              </button>
              <button
                aria-label={`Close ${meta.label}`}
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'closeTab', paneId: node.id, tab })
                }}
                className="ml-0.5 rounded-full p-0.5 text-muted transition-colors hover:bg-line hover:text-fg"
              >
                <Icon d="M6 6l12 12M18 6L6 18" className="h-3 w-3" />
              </button>
            </div>
          )
        })}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            aria-label="Split right"
            title={canSplit ? 'Split right' : 'Maximum panes reached'}
            disabled={!canSplit}
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'splitPane', paneId: node.id, direction: 'row' })
            }}
            className="rounded p-1 text-muted transition-colors hover:bg-line hover:text-fg disabled:opacity-30"
          >
            <Icon d="M4 4h16v16H4zM12 4v16" className="h-3.5 w-3.5" />
          </button>
          <button
            aria-label="Split down"
            title={canSplit ? 'Split down' : 'Maximum panes reached'}
            disabled={!canSplit}
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'splitPane', paneId: node.id, direction: 'col' })
            }}
            className="rounded p-1 text-muted transition-colors hover:bg-line hover:text-fg disabled:opacity-30"
          >
            <Icon d="M4 4h16v16H4zM4 12h16" className="h-3.5 w-3.5" />
          </button>
          <button
            aria-label="Close pane"
            title="Close pane"
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'closePane', paneId: node.id })
            }}
            className="rounded p-1 text-muted transition-colors hover:bg-line hover:text-fg"
          >
            <Icon d="M6 6l12 12M18 6L6 18" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Content */}
      <div
        role="tabpanel"
        aria-label={activeTab ? TAB_REGISTRY[activeTab].label : 'Empty pane'}
        className="@container flex-1 min-h-0 overflow-auto p-4"
      >
        {activeTab && TAB_REGISTRY[activeTab].render(data)}
      </div>
    </div>
  )
}
