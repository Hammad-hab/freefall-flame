/**
 * Links between the Data Table and the sandbox, by NASA test id.
 *
 *   /dashboard?tab=sandbox&preset=B14        the sandbox, preset B14 loaded in standby
 *   /dashboard?tab=visualization&test=B14    the Data Table, row B14 pinned and highlighted
 *
 * The hrefs are real URLs (they work when opened in a new tab or reloaded);
 * a plain click is handled inside the workspace without a page load. No React.
 */

/** A test id as it may appear in a link: letters, digits and dashes ("B14", "T28a", "SF1-S1"). */
export function cleanTestId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9-]{1,16}$/.test(value) ? value : null
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

/** A plain left click (no modifier keys): handle it in the page; anything else is left to the browser. */
export function isPlainClick(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

/** What the workspace passes to the tabs for the links. */
export interface WorkspaceLinks {
  sandboxHref: (testId: string) => string
  tableHref: (testId: string) => string
  /** Show the sandbox and load this test's preset in standby. */
  openInSandbox: (testId: string) => void
  /** Show the Data Table with this test's row pinned. */
  showInTable: (testId: string) => void
  /** A pending request for the sandbox (nonce: a new one for every click), or null. */
  sandboxRequest: { testId: string; nonce: number } | null
  /** The sandbox calls this once it has handled the request. */
  sandboxRequestDone: () => void
  /** The test whose row the Data Table pins, or null. */
  tableTest: string | null
}
