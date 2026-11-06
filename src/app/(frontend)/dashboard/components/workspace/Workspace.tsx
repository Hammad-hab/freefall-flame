'use client'

import { useCallback, useReducer, useRef, useState } from 'react'
import type { DatasetMeta, DataRow } from '@/lib/types'
import type { ParsedRow } from '@/lib/combustion'
import type { ShareResult } from '@/lib/shares'
import { createInitialState, layoutReducer, countLeaves, type TabId } from './layout-reducer'
import type { TabData } from './tabs'
import {
  cardHref,
  demoHref,
  groupHref,
  moonHref,
  sandboxHref,
  tableHref,
  visualizationHref,
  type SandboxGroup,
  type SandboxRequest,
  type WorkspaceLinks,
} from './links'
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
  /** ?tab=sandbox&group=saffire: open that preset group. */
  initialGroup?: SandboxGroup | null
  /** ?tab=sandbox&demo=cfig: play the gas flame demo. */
  initialDemo?: boolean
  /** ?tab=investigations&card=flex: bring that card into view. */
  initialCard?: string | null
  /** ?tab=sandbox&scenario=moon: run the Moon-base what-if. */
  initialMoon?: boolean
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
  initialGroup = null,
  initialDemo = false,
  initialCard = null,
  initialMoon = false,
}: WorkspaceProps) {
  const [state, dispatch] = useReducer(layoutReducer, initialTab, (tab) => createInitialState(4, tab))
  const dragRef = useRef<DragState | null>(null)

  // Links between the tabs (links.ts).
  const [sandboxRequest, setSandboxRequest] = useState<SandboxRequest | null>(
    initialPreset ? { kind: 'preset', testId: initialPreset, nonce: 1 }
      : initialGroup ? { kind: 'group', group: initialGroup, nonce: 1 }
      : initialDemo ? { kind: 'demo', nonce: 1 }
      : initialMoon ? { kind: 'moon', nonce: 1 }
      : null,
  )
  const [tableTest, setTableTest] = useState<string | null>(initialTest)
  const [card, setCard] = useState(initialCard ? { id: initialCard, nonce: 1 } : null)
  const nonce = useRef(1)
  const next = () => (nonce.current += 1)
  const toSandbox = useCallback((testId: string) => sandboxHref(testId, datasetParam), [datasetParam])
  const toTable = useCallback((testId: string) => tableHref(testId, datasetParam), [datasetParam])
  const toGroup = useCallback((g: SandboxGroup) => groupHref(g, datasetParam), [datasetParam])
  const toDemo = useCallback(() => demoHref(datasetParam), [datasetParam])
  const toCard = useCallback((id: string) => cardHref(id, datasetParam), [datasetParam])
  const go = (tab: TabId, url: string) => {
    dispatch({ type: 'showTab', tab })
    window.history.replaceState(null, '', url)
  }
  const links: WorkspaceLinks = {
    sandboxHref: toSandbox,
    tableHref: toTable,
    groupHref: toGroup,
    demoHref: toDemo,
    cardHref: toCard,
    visualizationHref: () => visualizationHref(datasetParam),
    openVisualization: () => go('visualization', visualizationHref(datasetParam)),
    openInSandbox: (testId) => {
      setSandboxRequest({ kind: 'preset', testId, nonce: next() })
      go('sandbox', toSandbox(testId))
    },
    openGroup: (group) => {
      setSandboxRequest({ kind: 'group', group, nonce: next() })
      go('sandbox', toGroup(group))
    },
    openDemo: () => {
      setSandboxRequest({ kind: 'demo', nonce: next() })
      go('sandbox', toDemo())
    },
    moonHref: () => moonHref(datasetParam),
    openMoon: () => {
      setSandboxRequest({ kind: 'moon', nonce: next() })
      go('sandbox', moonHref(datasetParam))
    },
    showInTable: (testId) => {
      setTableTest(testId)
      go('visualization', toTable(testId))
    },
    showCard: (id) => {
      setCard({ id, nonce: next() })
      go('investigations', toCard(id))
    },
    sandboxRequest,
    sandboxRequestDone: () => setSandboxRequest(null),
    tableTest,
    card,
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
