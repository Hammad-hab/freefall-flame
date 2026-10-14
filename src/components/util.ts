import 'server-only'

import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import config from '@/payload.config'

// Types and pure column helpers live in src/lib so client components can
// import them without pulling in this server-only module.
import type { Column, DataRow, DatasetBundle, DatasetMeta } from '@/lib/types'
export type { ColumnType, Column, PaperRef, DatasetMeta, DataRow, DatasetBundle } from '@/lib/types'
export {
  getColumn,
  columnsOfType,
  numericColumns,
  categoryColumns,
  columnLabel,
  numericValues,
} from '@/lib/columns'

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 1000
const REVALIDATE_SECONDS = 60

async function getClient() {
  return getPayload({ config: await config })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMeta(doc: any): DatasetMeta {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? null,
    columns: (doc.columns ?? []) as Column[],
    rowCount: doc.rowCount ?? 0,
    lastImportedAt: doc.lastImportedAt ?? null,
    // Papers come back as objects when populated and readable, or as bare ids when not.
    papers: (doc.papers ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => p && typeof p === 'object')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({
        id: p.id,
        title: p.title,
        ntrsId: p.ntrsId ?? null,
        sourceUrl: p.sourceUrl ?? null,
      })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(doc: any): DataRow {
  const paper = doc.sourcePaper
  return {
    ...(doc.data ?? {}),
    _id: doc.id,
    _index: doc.rowIndex ?? null,
    _paper: paper && typeof paper === 'object' ? paper.id : (paper ?? null),
    _page: doc.sourcePage ?? null,
    _rawData: doc.rawData ?? null,
  }
}

/* ------------------------------------------------------------------ */
/* Fetchers                                                            */
/* ------------------------------------------------------------------ */

/** All published datasets, for index pages and dataset pickers. */
export const getPublishedDatasets = unstable_cache(
  async (): Promise<DatasetMeta[]> => {
    const payload = await getClient()
    const res = await payload.find({
      collection: 'datasets',
      where: { published: { equals: true } },
      sort: 'name',
      limit: 100,
      depth: 1,
      overrideAccess: false, // enforce the public access rules (published only)
    })
    return res.docs.map(toMeta)
  },
  ['published-datasets'],
  { tags: ['datasets'], revalidate: REVALIDATE_SECONDS },
)

/** One published dataset's definition (columns, papers). Returns null if missing or unpublished. */
export async function getDataset(id: number | string): Promise<DatasetMeta | null> {
  const payload = await getClient()
  try {
    const doc = await payload.findByID({
      collection: 'datasets',
      id,
      depth: 1,
      overrideAccess: false,
    })
    return doc ? toMeta(doc) : null
  } catch {
    return null // not found, or not visible to the public
  }
}

/**
 * One page of rows. Only call this for a dataset you've already confirmed is
 * published (use getDataset or getDatasetBundle), because it skips row access checks.
 */
export async function getRowsPage(
  datasetId: number | string,
  page = 1,
  limit = PAGE_SIZE,
) {
  const payload = await getClient()
  const res = await payload.find({
    collection: 'dataset-rows',
    where: { dataset: { equals: datasetId } },
    sort: 'rowIndex',
    page,
    limit,
    depth: 0,
    pagination: true,
  })
  return { rows: res.docs.map(toRow), totalRows: res.totalDocs, hasNextPage: res.hasNextPage }
}

/** Every row of a dataset (loops through pages). Same caution as getRowsPage. */
export async function getAllRows(datasetId: number | string): Promise<DataRow[]> {
  const all: DataRow[] = []
  let page = 1
  for (;;) {
    const res = await getRowsPage(datasetId, page)
    all.push(...res.rows)
    if (!res.hasNextPage) break
    page += 1
  }
  return all
}

/**
 * Dataset definition plus all its rows, cached for a minute.
 * Returns null when the dataset doesn't exist or isn't published.
 */
export async function getDatasetBundle(id: number | string): Promise<DatasetBundle | null> {
  return unstable_cache(
    async () => {
      const dataset = await getDataset(id)
      if (!dataset) return null
      return { dataset, rows: await getAllRows(id) }
    },
    ['dataset-bundle', String(id)],
    { tags: ['datasets', `dataset-${id}`], revalidate: REVALIDATE_SECONDS },
  )()
}
