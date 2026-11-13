/**
 * Which dataset the dashboard shows, and its rows, with the database calls
 * passed in (page.tsx passes the real ones from src/components/util.ts; the
 * unit test passes fakes). No React, no server-only imports.
 *
 *   notFound:    a bad or unknown ?dataset=, or nothing published
 *   unavailable: the database couldn't be reached (the friendly error page)
 *   ok:          the dataset and its rows
 */
import type { DataRow, DatasetMeta } from '@/lib/types'

export interface DashboardFetchers {
  /** Published datasets (may be a cached list). */
  published: () => Promise<DatasetMeta[]>
  /** Published datasets straight from the database. */
  publishedUncached: () => Promise<DatasetMeta[]>
  /** One published dataset, or null if missing or not public; throws if the database can't be reached. */
  dataset: (id: string) => Promise<DatasetMeta | null>
  rows: (id: string) => Promise<DataRow[]>
}

export type DashboardLoad =
  | { kind: 'notFound' }
  | { kind: 'unavailable'; error: unknown }
  | { kind: 'ok'; datasetId: string; dataset: DatasetMeta; rows: DataRow[] }

/** The default dataset: the first published one, preferring a BASS one. */
export function pickDefault(published: DatasetMeta[]): string | null {
  const pick = published.find((d) => /bass/i.test(d.name)) ?? published[0]
  return pick ? String(pick.id) : null
}

export async function loadDashboard(param: string | string[] | undefined, f: DashboardFetchers): Promise<DashboardLoad> {
  // A bad id shows "not found" before any database call (a missing id once became NaN in SQL).
  if (param !== undefined && !(typeof param === 'string' && /^\d+$/.test(param))) return { kind: 'notFound' }
  try {
    let datasetId = param === undefined ? pickDefault(await f.published()) : param
    if (datasetId === null) return { kind: 'notFound' }
    let ds = await f.dataset(datasetId)
    if (!ds && param === undefined) {
      // The cached list of published datasets can be stale right after a
      // published flag changes, and name a dataset that is no longer public.
      // Ask the database again without the cache and pick again.
      const fresh = pickDefault(await f.publishedUncached())
      if (fresh !== null && fresh !== datasetId) {
        datasetId = fresh
        ds = await f.dataset(fresh)
      }
    }
    if (!ds) return { kind: 'notFound' }
    // Rows skip access checks, so fetch them only once the dataset is known to be published.
    const rows = await f.rows(datasetId)
    return { kind: 'ok', datasetId, dataset: ds, rows }
  } catch (error) {
    return { kind: 'unavailable', error }
  }
}
