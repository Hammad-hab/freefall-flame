'use client'

import {
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  countLeaves,
  type LayoutAction,
  type LayoutNode,
  type LayoutState,
  type NodeId,
  type SplitNode,
} from './layout-reducer'
import type { TabData } from './tabs'
import PaneView, { type DragState } from './PaneView'

interface LayoutTreeProps {
  state: LayoutState
  data: TabData
  dispatch: Dispatch<LayoutAction>
  dragRef: React.MutableRefObject<DragState | null>
}

export default function LayoutTree({ state, data, dispatch, dragRef }: LayoutTreeProps) {
  return <TreeNode nodeId={state.root} state={state} data={data} dispatch={dispatch} dragRef={dragRef} />
}

interface TreeNodeProps extends LayoutTreeProps {
  nodeId: NodeId
}

function TreeNode({ nodeId, state, data, dispatch, dragRef }: TreeNodeProps) {
  const node: LayoutNode | undefined = state.nodes[nodeId]
  if (!node) return null

  if (node.kind === 'leaf') {
    return (
      <PaneView
        node={node}
        data={data}
        focused={state.focusedPane === nodeId}
        canSplit={countLeaves(state) < state.maxPanes}
        dispatch={dispatch}
        dragRef={dragRef}
      />
    )
  }

  return <SplitContainer node={node} state={state} data={data} dispatch={dispatch} dragRef={dragRef} />
}

interface SplitContainerProps extends LayoutTreeProps {
  node: SplitNode
}

function SplitContainer({ node, state, data, dispatch, dragRef }: SplitContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const startPos = node.direction === 'row' ? e.clientX : e.clientY
    const [s0] = node.sizes
    const total = node.sizes[0] + node.sizes[1]
    const extent = node.direction === 'row' ? rect.width : rect.height

    // Window listeners receive the native DOM PointerEvent, not React's synthetic one.
    const onMove = (ev: PointerEvent) => {
      const delta = (node.direction === 'row' ? ev.clientX : ev.clientY) - startPos
      const deltaPct = (delta / extent) * 100
      const newS0 = Math.min(90, Math.max(10, s0 + deltaPct))
      dispatch({ type: 'resize', splitId: node.id, sizes: [newS0, total - newS0] })
    }

    const onUp = () => {
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    setDragging(true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 5
    const total = node.sizes[0] + node.sizes[1]
    const [s0] = node.sizes
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      const newS0 = Math.max(10, s0 - step)
      dispatch({ type: 'resize', splitId: node.id, sizes: [newS0, total - newS0] })
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      const newS0 = Math.min(90, s0 + step)
      dispatch({ type: 'resize', splitId: node.id, sizes: [newS0, total - newS0] })
    }
  }

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full min-h-0 min-w-0 ${
        node.direction === 'row' ? 'flex-row' : 'flex-col'
      }`}
    >
      <div style={{ flex: `0 0 calc(${node.sizes[0]}% - 2px)` }} className="min-h-0 min-w-0">
        <TreeNode nodeId={node.children[0]} state={state} data={data} dispatch={dispatch} dragRef={dragRef} />
      </div>
      <div
        role="separator"
        aria-orientation={node.direction === 'row' ? 'vertical' : 'horizontal'}
        aria-label="Resize panes"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-center bg-line transition-colors ${
          node.direction === 'row' ? 'cursor-col-resize' : 'cursor-row-resize'
        } ${dragging ? 'bg-flame-amber/40' : 'hover:bg-flame-amber/25'}`}
        style={{ flex: '0 0 4px' }}
      >
        <div
          className={`rounded-full bg-muted/40 ${
            node.direction === 'row' ? 'h-6 w-1' : 'h-1 w-6'
          }`}
        />
      </div>
      <div style={{ flex: `0 0 calc(${node.sizes[1]}% - 2px)` }} className="min-h-0 min-w-0">
        <TreeNode nodeId={node.children[1]} state={state} data={data} dispatch={dispatch} dragRef={dragRef} />
      </div>
    </div>
  )
}
