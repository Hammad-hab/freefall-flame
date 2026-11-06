'use client'

import { useCallback, useReducer, useRef, useState } from 'react'
import type { DatasetMeta, DataRow } from '@/lib/types'
import type { ParsedRow } from '@/lib/combustion'
import type { ShareResult } from '@/lib/shares'
import { createInitialState, layoutReducer, countLeaves, type TabId } from './layout-reducer'
import type { TabData } from './tabs'
import { sandboxHref, tableHref, type WorkspaceLinks } from './links'
import Sidebar from './Sidebar'
import LayoutTree from './LayoutTree'
import type { DragState } from './PaneView'

interface WorkspaceProps {
  dataset: DatasetMeta
  rows: DataRow[]
  parsedRows: ParsedRow[]
  shares: ShareResult
  datasetId: string
  /** The ?dataset= the page was opened with (null: the default dataset); links keep it. */
  datasetParam?: string | null
  initialTab: TabId
  /** ?tab=sandbox&preset=B14: load this preset in standby. */
  initialPreset?: string | null
  /** ?test=B14: pin this row in the Data Table. */
  initialTest?: string | null
}

export default function Workspace({
  dataset,
  rows,
  parsedRows,
  shares,
  datasetId,
  datasetParam = null,
  initialTab,
  initialPreset = null,
  initialTest = null,
}: WorkspaceProps) {
  const [state, dispatch] = useReducer(layoutReducer, initialTab, (tab) => createInitialState(4, tab))
  const dragRef = useRef<DragState | null>(null)

  // Links between the Data Table and the sandbox (links.ts).
  const [sandboxRequest, setSandboxRequest] = useState(
    initialPreset ? { testId: initialPreset, nonce: 1 } : null,
  )
  const [tableTest, setTableTest] = useState<string | null>(initialTest)
  const nonce = useRef(1)
  const toSandbox = useCallback((testId: string) => sandboxHref(testId, datasetParam), [datasetParam])
  const toTable = useCallback((testId: string) => tableHref(testId, datasetParam), [datasetParam])
  const links: WorkspaceLinks = {
    sandboxHref: toSandbox,
    tableHref: toTable,
    openInSandbox: (testId) => {
      nonce.current += 1
      setSandboxRequest({ testId, nonce: nonce.current })
      dispatch({ type: 'showTab', tab: 'sandbox' })
      window.history.replaceState(null, '', toSandbox(testId))
    },
    showInTable: (testId) => {
      setTableTest(testId)
      dispatch({ type: 'showTab', tab: 'visualization' })
      window.history.replaceState(null, '', toTable(testId))
    },
    sandboxRequest,
    sandboxRequestDone: () => setSandboxRequest(null),
    tableTest,
  }

  const data: TabData = {
    dataset,
    rows,
    parsedRows,
    shares,
    datasetId,
    datasetName: dataset.name,
    links,
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
