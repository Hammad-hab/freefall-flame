/**
 * Links between the dashboard's tabs, by NASA test id or investigation.
 *
 *   /dashboard?tab=sandbox&preset=B14          the sandbox, preset B14 loaded in standby
 *   /dashboard?tab=sandbox&group=saffire       the sandbox's Saffire presets
 *   /dashboard?tab=sandbox&demo=cfig           the sandbox, the gas flame demo playing
 *   /dashboard?tab=visualization&test=B14      the Data Table, row B14 pinned and highlighted
 *   /dashboard?tab=investigations&card=flex    the PSI catalogue, the FLEX card in view
 *
 * The hrefs are real URLs (they work when opened in a new tab or reloaded);
 * a plain click is handled inside the workspace without a page load. No React.
 */

/** A test id as it may appear in a link: letters, digits and dashes ("B14", "T28a", "SF1-S1"). */
export function cleanTestId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9-]{1,16}$/.test(value) ? value : null
}

/** An investigation id as in psi.json ("bass-ii", "cfi-g"). */
export function cleanCardId(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9-]{1,40}$/.test(value) ? value : null
}

export type SandboxGroup = 'bass' | 'saffire'
export function cleanGroup(value: unknown): SandboxGroup | null {
  return value === 'bass' || value === 'saffire' ? value : null
}

function href(params: Record<string, string>, datasetParam: string | null): string {
  const q = new URLSearchParams()
  if (datasetParam) q.set('dataset', datasetParam)
  for (const [k, v] of Object.entries(params)) q.set(k, v)
  return `/dashboard?${q.toString()}`
}

/** The sandbox with this test's preset loaded in standby. datasetParam: keep an explicit ?dataset=. */
export function sandboxHref(testId: string, datasetParam: string | null = null): string {
  return href({ tab: 'sandbox', preset: testId }, datasetParam)
}

/** The Data Table with this test's row pinned and highlighted. */
export function tableHref(testId: string, datasetParam: string | null = null): string {
  return href({ tab: 'visualization', test: testId }, datasetParam)
}

/** One of the sandbox's preset groups. */
export function groupHref(group: SandboxGroup, datasetParam: string | null = null): string {
  return href({ tab: 'sandbox', group }, datasetParam)
}

/** The sandbox with the gas flame demo playing. */
export function demoHref(datasetParam: string | null = null): string {
  return href({ tab: 'sandbox', demo: 'cfig' }, datasetParam)
}

/** The Visualization tab. */
export function visualizationHref(datasetParam: string | null = null): string {
  return href({ tab: 'visualization' }, datasetParam)
}

/** The PSI catalogue with one investigation's card in view. */
export function cardHref(cardId: string, datasetParam: string | null = null): string {
  return href({ tab: 'investigations', card: cardId }, datasetParam)
}

/** A plain left click (no modifier keys): handle it in the page; anything else is left to the browser. */
export function isPlainClick(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

/** What a link asks the sandbox to do (nonce: a new one for every click). */
export type SandboxRequest =
  | { kind: 'preset'; testId: string; nonce: number }
  | { kind: 'group'; group: SandboxGroup; nonce: number }
  | { kind: 'demo'; nonce: number }

/** What the workspace passes to the tabs for the links. */
export interface WorkspaceLinks {
  sandboxHref: (testId: string) => string
  tableHref: (testId: string) => string
  groupHref: (group: SandboxGroup) => string
  demoHref: () => string
  cardHref: (cardId: string) => string
  /** The Visualization tab (the BASS-II charts and Data Table). */
  visualizationHref: () => string
  /** Show the Visualization tab. */
  openVisualization: () => void
  /** Show the sandbox and load this test's preset in standby. */
  openInSandbox: (testId: string) => void
  /** Show the sandbox with one of its preset groups. */
  openGroup: (group: SandboxGroup) => void
  /** Show the sandbox and play the gas flame demo. */
  openDemo: () => void
  /** Show the Data Table with this test's row pinned. */
  showInTable: (testId: string) => void
  /** Show the PSI catalogue with this card in view. */
  showCard: (cardId: string) => void
  /** A pending request for the sandbox, or null. */
  sandboxRequest: SandboxRequest | null
  /** The sandbox calls this once it has handled the request. */
  sandboxRequestDone: () => void
  /** The test whose row the Data Table pins, or null. */
  tableTest: string | null
  /** The card the catalogue brings into view (nonce: a new one for every click), or null. */
  card: { id: string; nonce: number } | null
}

/** Props for a link that is a real URL but, on a plain click, runs `go` in the page. */
export function linkProps(hrefValue: string, go: () => void) {
  return {
    href: hrefValue,
    onClick: (e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault: () => void }) => {
      if (!isPlainClick(e)) return
      e.preventDefault()
      go()
    },
  }
}
