'use client'

import { useReducer, useRef } from 'react'
import type { DatasetMeta, DataRow } from '@/lib/types'
import type { ParsedRow } from '@/lib/combustion'
import type { ShareResult } from '@/lib/shares'
import { createInitialState, layoutReducer, countLeaves, type TabId } from './layout-reducer'
import type { TabData } from './tabs'
import Sidebar from './Sidebar'
import LayoutTree from './LayoutTree'
import type { DragState } from './PaneView'

interface WorkspaceProps {
  dataset: DatasetMeta
  rows: DataRow[]
  parsedRows: ParsedRow[]
  shares: ShareResult
  datasetId: string
  initialTab: TabId
}

export default function Workspace({
  dataset,
  rows,
  parsedRows,
  shares,
  datasetId,
  initialTab,
}: WorkspaceProps) {
  const [state, dispatch] = useReducer(layoutReducer, initialTab, (tab) => createInitialState(4, tab))
  const dragRef = useRef<DragState | null>(null)

  const data: TabData = {
    dataset,
    rows,
    parsedRows,
    shares,
    datasetId,
    datasetName: dataset.name,
  }

  const focusedNode = state.focusedPane ? state.nodes[state.focusedPane] : null
  const activeTabInFocused =
    focusedNode && focusedNode.kind === 'leaf' ? focusedNode.activeTab : null

  const canSplit = countLeaves(state) < state.maxPanes
  // Sidebar split-right targets the focused pane, or the root when unfocused (empty state).
  const splitSource = state.focusedPane ?? state.root

  return (
    <div className="flex h-screen w-full overflow-hidden bg-ink text-fg">
      <Sidebar
        activeTab={activeTabInFocused}
        canSplit={canSplit}
        onOpenTab={(tab) => dispatch({ type: 'openTab', tab })}
        onSplitRight={(tab) =>
          dispatch({ type: 'splitPane', paneId: splitSource, direction: 'row', tab })
        }
      />
      <div className="min-w-0 flex-1">
        <LayoutTree state={state} data={data} dispatch={dispatch} dragRef={dragRef} />
      </div>
    </div>
  )
}
