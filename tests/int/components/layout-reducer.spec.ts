import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  layoutReducer,
  countLeaves,
  firstLeafId,
  findParent,
  type LayoutState,
  type TabId,
} from '@/app/(frontend)/dashboard/components/workspace/layout-reducer'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function leaf(state: LayoutState, id: string) {
  const n = state.nodes[id]
  if (!n || n.kind !== 'leaf') throw new Error(`not a leaf: ${id}`)
  return n
}

function split(state: LayoutState, id: string) {
  const n = state.nodes[id]
  if (!n || n.kind !== 'split') throw new Error(`not a split: ${id}`)
  return n
}

/* ------------------------------------------------------------------ */
/* Initial state                                                       */
/* ------------------------------------------------------------------ */

describe('createInitialState', () => {
  it('creates a single pane with the initial tab open', () => {
    const s = createInitialState(4, 'overview')
    expect(s.root).toBe('n1')
    expect(leaf(s, 'n1').tabs).toEqual(['overview'])
    expect(leaf(s, 'n1').activeTab).toBe('overview')
    expect(s.focusedPane).toBe('n1')
    expect(countLeaves(s)).toBe(1)
  })

  it('creates an empty pane when no initial tab is given', () => {
    const s = createInitialState(4)
    expect(leaf(s, 'n1').tabs).toEqual([])
    expect(leaf(s, 'n1').activeTab).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* openTab                                                             */
/* ------------------------------------------------------------------ */

describe('openTab', () => {
  it('opens a new tab in the focused pane', () => {
    const s = createInitialState(4, 'overview')
    const s2 = layoutReducer(s, { type: 'openTab', tab: 'evidence' })
    expect(leaf(s2, 'n1').tabs).toEqual(['overview', 'evidence'])
    expect(leaf(s2, 'n1').activeTab).toBe('evidence')
    expect(s2.focusedPane).toBe('n1')
  })

  it('activates an already-open tab instead of duplicating it', () => {
    const s = createInitialState(4, 'overview')
    const s2 = layoutReducer(s, { type: 'openTab', tab: 'evidence' })
    const s3 = layoutReducer(s2, { type: 'openTab', tab: 'overview' })
    expect(leaf(s3, 'n1').tabs).toEqual(['overview', 'evidence'])
    expect(leaf(s3, 'n1').activeTab).toBe('overview')
  })
})

/* ------------------------------------------------------------------ */
/* splitPane                                                           */
/* ------------------------------------------------------------------ */

describe('splitPane', () => {
  it('splits a root leaf into a row split, copying the active tab', () => {
    const s = createInitialState(4, 'overview')
    const s2 = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    // root is now a split
    expect(split(s2, 'n2').direction).toBe('row')
    expect(split(s2, 'n2').children).toEqual(['n1', 'n3'])
    expect(split(s2, 'n2').sizes).toEqual([50, 50])
    // new pane copied the active tab
    expect(leaf(s2, 'n3').tabs).toEqual(['overview'])
    expect(leaf(s2, 'n3').activeTab).toBe('overview')
    // original pane unchanged
    expect(leaf(s2, 'n1').tabs).toEqual(['overview'])
    expect(s2.focusedPane).toBe('n3')
    expect(countLeaves(s2)).toBe(2)
  })

  it('splits a non-root leaf, replacing it in the parent split', () => {
    // Build: split [n1, n3] then split n3 down → split [n1, split[n3, n5]]
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n3', direction: 'col' })
    // root split n2: children [n1, n4], n4 is split [n3, n5]
    expect(split(s, 'n2').children).toEqual(['n1', 'n4'])
    expect(split(s, 'n4').direction).toBe('col')
    expect(split(s, 'n4').children).toEqual(['n3', 'n5'])
    expect(findParent(s, 'n3')).toBe('n4')
    expect(countLeaves(s)).toBe(3)
  })

  it('opens a specific tab in the new pane (sidebar split-right)', () => {
    const s = createInitialState(4, 'overview')
    const s2 = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row', tab: 'evidence' })
    expect(leaf(s2, 'n3').tabs).toEqual(['evidence'])
    expect(leaf(s2, 'n3').activeTab).toBe('evidence')
    // original pane still only has overview
    expect(leaf(s2, 'n1').tabs).toEqual(['overview'])
  })

  it('refuses to split beyond the pane cap', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' }) // 2 panes
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' }) // 3 panes
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n3', direction: 'row' }) // 4 panes
    expect(countLeaves(s)).toBe(4)
    const before = s
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    expect(s).toBe(before) // unchanged reference
    expect(countLeaves(s)).toBe(4)
  })
})

/* ------------------------------------------------------------------ */
/* closeTab / closePane                                                */
/* ------------------------------------------------------------------ */

describe('closeTab', () => {
  it('removes the tab and activates a neighbour', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'openTab', tab: 'evidence' })
    s = layoutReducer(s, { type: 'openTab', tab: 'papers' })
    // tabs: [overview, evidence, papers], active: papers
    const s2 = layoutReducer(s, { type: 'closeTab', paneId: 'n1', tab: 'evidence' })
    expect(leaf(s2, 'n1').tabs).toEqual(['overview', 'papers'])
    expect(leaf(s2, 'n1').activeTab).toBe('papers')
  })

  it('closing the last tab closes the pane', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    // n3 has [overview]
    const s2 = layoutReducer(s, { type: 'closeTab', paneId: 'n3', tab: 'overview' })
    // n3 closes → parent split n2 collapses → root is n1
    expect(s2.root).toBe('n1')
    expect(leaf(s2, 'n1').tabs).toEqual(['overview'])
    expect(s2.nodes['n2']).toBeUndefined()
    expect(s2.nodes['n3']).toBeUndefined()
  })
})

describe('closePane', () => {
  it('collapses a parent split when one child is closed', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    // split n2 [n1, n3]; close n3 → collapse to n1
    const s2 = layoutReducer(s, { type: 'closePane', paneId: 'n3' })
    expect(s2.root).toBe('n1')
    expect(countLeaves(s2)).toBe(1)
    expect(s2.focusedPane).toBe('n1')
  })

  it('collapses nested splits up to the surviving branch', () => {
    // split [n1, split[n3, n5]]; close n1 → root becomes split[n3, n5]
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n3', direction: 'col' })
    const s2 = layoutReducer(s, { type: 'closePane', paneId: 'n1' })
    expect(s2.root).toBe('n4')
    expect(split(s2, 'n4').children).toEqual(['n3', 'n5'])
    expect(s2.focusedPane).toBe('n5')
  })

  it('produces an empty state when the only pane is closed', () => {
    const s = createInitialState(4, 'overview')
    const s2 = layoutReducer(s, { type: 'closePane', paneId: 'n1' })
    expect(s2.root).not.toBe('n1')
    expect(leaf(s2, s2.root).tabs).toEqual([])
    expect(s2.focusedPane).toBeNull()
    expect(countLeaves(s2)).toBe(1)
  })

  it('moves focus to the survivor when the focused pane is closed', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    // focus is n3 (the new pane); close it → focus back to n1
    const s2 = layoutReducer(s, { type: 'closePane', paneId: 'n3' })
    expect(s2.focusedPane).toBe('n1')
  })
})

describe('moveTab', () => {
  it('moves a tab from one pane to another', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    // n1 has [overview], n3 has [overview]
    const s2 = layoutReducer(s, { type: 'moveTab', fromPane: 'n1', toPane: 'n3', tab: 'overview' })
    // overview removed from n1 (now empty → closes), added to n3
    // After closePane(n1), split n2 collapses to n3
    expect(s2.root).toBe('n3')
    expect(leaf(s2, 'n3').tabs).toContain('overview')
    expect(leaf(s2, 'n3').activeTab).toBe('overview')
  })

  it('moves a tab without closing the source pane when other tabs remain', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'openTab', tab: 'evidence' })
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    // n1: [overview, evidence], n3: [evidence] (copied active tab)
    const s2 = layoutReducer(s, { type: 'moveTab', fromPane: 'n1', toPane: 'n3', tab: 'overview' })
    // overview moved from n1 to n3
    expect(leaf(s2, 'n1').tabs).toEqual(['evidence'])
    expect(leaf(s2, 'n3').tabs).toEqual(['evidence', 'overview'])
    expect(leaf(s2, 'n3').activeTab).toBe('overview')
    expect(s2.focusedPane).toBe('n3')
  })

  it('does nothing when moving to the same pane', () => {
    const s = createInitialState(4, 'overview')
    const s2 = layoutReducer(s, { type: 'moveTab', fromPane: 'n1', toPane: 'n1', tab: 'overview' })
    expect(s2).toBe(s)
  })

  it('does nothing when the tab is not in the source pane', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    const s2 = layoutReducer(s, { type: 'moveTab', fromPane: 'n1', toPane: 'n3', tab: 'papers' })
    expect(leaf(s2, 'n1').tabs).toEqual(['overview'])
    expect(leaf(s2, 'n3').tabs).toEqual(['overview'])
  })

  it('handles moveTab when target already has the tab', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'openTab', tab: 'evidence' })
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    // n1: [overview, evidence], n3: [evidence] (copied active tab)
    // Move overview to n3 — n3 doesn't have it, so it's appended
    const s2 = layoutReducer(s, { type: 'moveTab', fromPane: 'n1', toPane: 'n3', tab: 'overview' })
    expect(leaf(s2, 'n1').tabs).toEqual(['evidence'])
    expect(leaf(s2, 'n3').tabs).toEqual(['evidence', 'overview'])
    expect(leaf(s2, 'n3').activeTab).toBe('overview')
  })
})

/* ------------------------------------------------------------------ */
/* resize                                                              */
/* ------------------------------------------------------------------ */

describe('resize', () => {
  it('updates the sizes of a split node', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    const s2 = layoutReducer(s, { type: 'resize', splitId: 'n2', sizes: [30, 70] })
    expect(split(s2, 'n2').sizes).toEqual([30, 70])
  })
})

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

describe('helpers', () => {
  it('firstLeafId returns the leftmost leaf', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    expect(firstLeafId(s)).toBe('n1')
  })

  it('findParent returns the enclosing split', () => {
    let s = createInitialState(4, 'overview')
    s = layoutReducer(s, { type: 'splitPane', paneId: 'n1', direction: 'row' })
    expect(findParent(s, 'n1')).toBe('n2')
    expect(findParent(s, 'n3')).toBe('n2')
    expect(findParent(s, 'n2')).toBeNull()
  })
})
