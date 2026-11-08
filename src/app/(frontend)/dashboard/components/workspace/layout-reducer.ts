/**
 * Pure layout reducer for the JupyterLab-style workspace.
 *
 * Models the main area as a tree of nodes:
 *   - leaf:  a pane with its own tab strip { id, tabs, activeTab }
 *   - split: a directional split with two children and relative sizes
 *
 * This module has NO React imports so it can be unit-tested in isolation.
 * All operations are immutable (state in, new state out).
 */

export type TabId = 'overview' | 'investigations' | 'evidence' | 'visualization' | 'ai-summary' | 'papers' | 'sandbox' | 'customize'

export type Direction = 'row' | 'col'

export type NodeId = string

export interface LeafNode {
  id: NodeId
  kind: 'leaf'
  tabs: TabId[]
  activeTab: TabId | null
}

export interface SplitNode {
  id: NodeId
  kind: 'split'
  direction: Direction
  children: [NodeId, NodeId]
  /** Relative sizes of the two children, summing to ~100. */
  sizes: [number, number]
}

export type LayoutNode = LeafNode | SplitNode

export interface LayoutState {
  root: NodeId
  nodes: Record<NodeId, LayoutNode>
  focusedPane: NodeId | null
  /** Monotonic counter for generating unique node ids. */
  nextId: number
  maxPanes: number
}

export type LayoutAction =
  | { type: 'openTab'; tab: TabId }
  | { type: 'showTab'; tab: TabId }
  | { type: 'activateTab'; paneId: NodeId; tab: TabId }
  | { type: 'closeTab'; paneId: NodeId; tab: TabId }
  | { type: 'focusPane'; paneId: NodeId }
  | { type: 'splitPane'; paneId: NodeId; direction: Direction; tab?: TabId }
  | { type: 'closePane'; paneId: NodeId }
  | { type: 'moveTab'; fromPane: NodeId; toPane: NodeId; tab: TabId }
  | { type: 'resize'; splitId: NodeId; sizes: [number, number] }

/* ------------------------------------------------------------------ */
/* Initial state                                                       */
/* ------------------------------------------------------------------ */

export function createInitialState(maxPanes = 4, initialTab?: TabId): LayoutState {
  const id = 'n1'
  return {
    root: id,
    nodes: {
      [id]: {
        id,
        kind: 'leaf',
        tabs: initialTab ? [initialTab] : [],
        activeTab: initialTab ?? null,
      },
    },
    focusedPane: id,
    nextId: 2,
    maxPanes,
  }
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

export function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case 'openTab':
      return openTab(state, action.tab)
    case 'showTab':
      return showTab(state, action.tab)
    case 'activateTab':
      return activateTab(state, action.paneId, action.tab)
    case 'closeTab':
      return closeTab(state, action.paneId, action.tab)
    case 'focusPane':
      return focusPane(state, action.paneId)
    case 'splitPane':
      return splitPane(state, action.paneId, action.direction, action.tab)
    case 'closePane':
      return closePane(state, action.paneId)
    case 'moveTab':
      return moveTab(state, action.fromPane, action.toPane, action.tab)
    case 'resize':
      return resize(state, action.splitId, action.sizes)
    default:
      return state
  }
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function openTab(state: LayoutState, tab: TabId): LayoutState {
  let paneId = state.focusedPane
  if (!paneId || !state.nodes[paneId] || state.nodes[paneId].kind !== 'leaf') {
    paneId = firstLeafId(state)
  }
  if (!paneId) return state
  const node = state.nodes[paneId]
  if (!node || node.kind !== 'leaf') return state

  const hasTab = node.tabs.includes(tab)
  const updated: LeafNode = hasTab
    ? { ...node, activeTab: tab }
    : { ...node, tabs: [...node.tabs, tab], activeTab: tab }

  return {
    ...state,
    nodes: { ...state.nodes, [paneId]: updated },
    focusedPane: paneId,
  }
}

/**
 * Bring a tab into view for a link: if a pane already has it, activate it
 * there (so a link never opens a second copy, e.g. a second sandbox engine);
 * otherwise open it like openTab.
 */
function showTab(state: LayoutState, tab: TabId): LayoutState {
  const leaves = Object.values(state.nodes).filter((n): n is LeafNode => n.kind === 'leaf')
  const focused = state.focusedPane ? state.nodes[state.focusedPane] : null
  const holder =
    focused && focused.kind === 'leaf' && focused.tabs.includes(tab)
      ? focused
      : leaves.find((n) => n.tabs.includes(tab) && isReachable(state, n.id))
  return holder ? activateTab(state, holder.id, tab) : openTab(state, tab)
}

function isReachable(state: LayoutState, id: NodeId): boolean {
  return id === state.root || findParent(state, id) !== null
}

function activateTab(state: LayoutState, paneId: NodeId, tab: TabId): LayoutState {
  const node = state.nodes[paneId]
  if (!node || node.kind !== 'leaf') return state
  if (!node.tabs.includes(tab)) return state
  return {
    ...state,
    nodes: { ...state.nodes, [paneId]: { ...node, activeTab: tab } },
    focusedPane: paneId,
  }
}

function closeTab(state: LayoutState, paneId: NodeId, tab: TabId): LayoutState {
  const node = state.nodes[paneId]
  if (!node || node.kind !== 'leaf') return state
  if (!node.tabs.includes(tab)) return state

  const idx = node.tabs.indexOf(tab)
  const tabs = node.tabs.filter((t) => t !== tab)
  let activeTab = node.activeTab
  if (activeTab === tab) {
    // Activate the neighbour that took the closed tab's place, or the last tab.
    activeTab = tabs.length === 0 ? null : tabs[Math.min(idx, tabs.length - 1)]
  }

  if (tabs.length === 0) {
    return closePane(state, paneId)
  }

  return {
    ...state,
    nodes: { ...state.nodes, [paneId]: { ...node, tabs, activeTab } },
  }
}

function focusPane(state: LayoutState, paneId: NodeId): LayoutState {
  if (!state.nodes[paneId]) return state
  return { ...state, focusedPane: paneId }
}

function splitPane(
  state: LayoutState,
  paneId: NodeId,
  direction: Direction,
  tab?: TabId,
): LayoutState {
  const node = state.nodes[paneId]
  if (!node || node.kind !== 'leaf') return state
  if (countLeaves(state) >= state.maxPanes) return state

  const newTab = tab ?? node.activeTab
  const splitId = `n${state.nextId}`
  const newId = `n${state.nextId + 1}`

  const newLeaf: LeafNode = {
    id: newId,
    kind: 'leaf',
    tabs: newTab ? [newTab] : [],
    activeTab: newTab,
  }
  const newSplit: SplitNode = {
    id: splitId,
    kind: 'split',
    direction,
    children: [paneId, newId],
    sizes: [50, 50],
  }

  const parentId = findParent(state, paneId)
  const nodes: Record<NodeId, LayoutNode> = {
    ...state.nodes,
    [newId]: newLeaf,
    [splitId]: newSplit,
  }

  let root = state.root
  if (!parentId) {
    root = splitId
  } else {
    const parent = nodes[parentId]
    if (parent && parent.kind === 'split') {
      nodes[parentId] = {
        ...parent,
        children: parent.children.map((c) => (c === paneId ? splitId : c)) as [NodeId, NodeId],
      }
    }
  }

  return {
    ...state,
    root,
    nodes,
    focusedPane: newId,
    nextId: state.nextId + 2,
  }
}

function closePane(state: LayoutState, paneId: NodeId): LayoutState {
  const node = state.nodes[paneId]
  if (!node || node.kind !== 'leaf') return state

  const parentId = findParent(state, paneId)

  // Closing the only pane → empty state.
  if (!parentId) {
    const emptyId = `n${state.nextId}`
    const emptyLeaf: LeafNode = { id: emptyId, kind: 'leaf', tabs: [], activeTab: null }
    return {
      ...state,
      root: emptyId,
      nodes: { [emptyId]: emptyLeaf },
      focusedPane: null,
      nextId: state.nextId + 1,
    }
  }

  const parent = state.nodes[parentId]
  if (!parent || parent.kind !== 'split') return state

  const survivor = parent.children[0] === paneId ? parent.children[1] : parent.children[0]
  const grandparentId = findParent(state, parentId)

  const nodes: Record<NodeId, LayoutNode> = { ...state.nodes }
  delete nodes[paneId]
  delete nodes[parentId]

  let root = state.root
  if (!grandparentId) {
    root = survivor
  } else {
    const grandparent = nodes[grandparentId]
    if (grandparent && grandparent.kind === 'split') {
      nodes[grandparentId] = {
        ...grandparent,
        children: grandparent.children.map((c) => (c === parentId ? survivor : c)) as [NodeId, NodeId],
      }
    }
  }

  const focusedPane = state.focusedPane === paneId ? survivor : state.focusedPane

  return { ...state, root, nodes, focusedPane }
}

function moveTab(state: LayoutState, fromPane: NodeId, toPane: NodeId, tab: TabId): LayoutState {
  const source = state.nodes[fromPane]
  const target = state.nodes[toPane]
  if (!source || source.kind !== 'leaf') return state
  if (!target || target.kind !== 'leaf') return state
  if (fromPane === toPane) return state
  if (!source.tabs.includes(tab)) return state

  const sourceIdx = source.tabs.indexOf(tab)
  const sourceTabs = source.tabs.filter((t) => t !== tab)
  let sourceActive = source.activeTab
  if (sourceActive === tab) {
    sourceActive = sourceTabs.length === 0 ? null : sourceTabs[Math.min(sourceIdx, sourceTabs.length - 1)]
  }

  const targetHasTab = target.tabs.includes(tab)
  const targetTabs = targetHasTab ? target.tabs : [...target.tabs, tab]

  const nodes: Record<NodeId, LayoutNode> = { ...state.nodes }
  nodes[toPane] = { ...target, tabs: targetTabs, activeTab: tab }

  if (sourceTabs.length === 0) {
    // Source pane is now empty → close it (may collapse parent split)
    return closePane({ ...state, nodes }, fromPane)
  }

  nodes[fromPane] = { ...source, tabs: sourceTabs, activeTab: sourceActive }
  return { ...state, nodes, focusedPane: toPane }
}

function resize(state: LayoutState, splitId: NodeId, sizes: [number, number]): LayoutState {
  const node = state.nodes[splitId]
  if (!node || node.kind !== 'split') return state
  return {
    ...state,
    nodes: { ...state.nodes, [splitId]: { ...node, sizes } },
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function firstLeafId(state: LayoutState): NodeId | null {
  const root = state.nodes[state.root]
  if (!root) return null
  if (root.kind === 'leaf') return root.id
  for (const childId of root.children) {
    const result = firstLeafId({ ...state, root: childId })
    if (result) return result
  }
  return null
}

export function findParent(state: LayoutState, id: NodeId): NodeId | null {
  function search(nodeId: NodeId): NodeId | null {
    const node = state.nodes[nodeId]
    if (!node || node.kind !== 'split') return null
    if (node.children[0] === id || node.children[1] === id) return nodeId
    for (const childId of node.children) {
      const result = search(childId)
      if (result) return result
    }
    return null
  }
  return search(state.root)
}

export function countLeaves(state: LayoutState): number {
  const root = state.nodes[state.root]
  if (!root) return 0
  if (root.kind === 'leaf') return 1
  return root.children.reduce((sum, childId) => sum + countLeaves({ ...state, root: childId }), 0)
}
