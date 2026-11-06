import {
  getDataset,
  getAllRows,
  getPublishedDatasets,
  getPublishedDatasetsUncached,
  type DataRow,
  type DatasetMeta,
} from "@/components/util"
import { DatasetNotFound } from "./components/ui/DatasetNotFound"
import Workspace from "./components/workspace/Workspace"
import type { TabId } from "./components/workspace/layout-reducer"
import { buildRowMapping, parseRows, resolveBass2Columns, type ParsedRow } from "@/lib/combustion"
import { computeShares } from "@/lib/shares"
import { cleanCardId, cleanGroup, cleanTestId } from "./components/workspace/links"

interface SearchPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const VALID_TABS: readonly TabId[] = ['overview', 'investigations', 'evidence', 'visualization', 'ai-summary', 'papers', 'sandbox']

type LoadedDataset = NonNullable<Awaited<ReturnType<typeof getDataset>>>

/** Shared parsed-row computation for the evidence panels. */
function parseForDataset(dataset: LoadedDataset, rows: DataRow[]): ParsedRow[] {
  return parseRows(rows, buildRowMapping(resolveBass2Columns(dataset.columns).resolutions))
}

/** The default dataset: the first published one, preferring a BASS one. */
function pickDefault(published: DatasetMeta[]): string | null {
  const pick = published.find((d) => /bass/i.test(d.name)) ?? published[0]
  return pick ? String(pick.id) : null
}

/**
 * The dataset id to show, or null for DatasetNotFound.
 * With no ?dataset=, falls back to the first published dataset, preferring a BASS one.
 */
async function resolveDatasetId(param: string | string[] | undefined): Promise<string | null> {
  if (param === undefined) return pickDefault(await getPublishedDatasets())
  return typeof param === 'string' && /^\d+$/.test(param) ? param : null
}

export default async function Page({ searchParams }: SearchPageProps) {
  const filters = await searchParams
  const dataset_id = filters.dataset
  const rawTab = filters.tab as string
  const initialTab: TabId = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as TabId)
    : "overview"

  // Resolve the id before touching the database: a bad id must show
  // DatasetNotFound, never reach a query (a missing id became NaN in SQL).
  let datasetId = await resolveDatasetId(dataset_id)
  if (datasetId === null) return <DatasetNotFound/>

  let ds: LoadedDataset | null = await getDataset(datasetId)
  if (!ds && dataset_id === undefined) {
    // The cached list of published datasets can be stale right after a
    // published flag changes, and name a dataset that is no longer public.
    // Ask the database again without the cache and pick again.
    const fresh = pickDefault(await getPublishedDatasetsUncached())
    if (fresh !== null && fresh !== datasetId) {
      datasetId = fresh
      ds = await getDataset(fresh)
    }
  }
  if (!ds) return <DatasetNotFound/>
  // Rows skip access checks, so fetch them only once the dataset is known to be published.
  const rows = await getAllRows(datasetId)
  const dataset: DatasetMeta = ds

  // The statistics card breaks the dataset down by whoever ran the tests,
  // so resolve that column once and share the result.
  const piColumn = resolveBass2Columns(dataset.columns).resolutions.pi?.column ?? null
  const shares = computeShares(rows, piColumn)
  const parsedRows = parseForDataset(dataset, rows)

  return (
    <Workspace
      dataset={dataset}
      rows={rows}
      parsedRows={parsedRows}
      shares={shares}
      datasetId={datasetId}
      datasetParam={dataset_id === undefined ? null : datasetId}
      initialTab={initialTab}
      // Links between the tabs (workspace/links.ts): ?tab=sandbox&preset=B14,
      // &group=saffire or &demo=cfig; ?tab=visualization&test=B14;
      // ?tab=investigations&card=flex.
      initialPreset={initialTab === 'sandbox' ? cleanTestId(filters.preset) : null}
      initialGroup={initialTab === 'sandbox' ? cleanGroup(filters.group) : null}
      initialDemo={initialTab === 'sandbox' && filters.demo === 'cfig'}
      initialTest={cleanTestId(filters.test)}
      initialCard={initialTab === 'investigations' ? cleanCardId(filters.card) : null}
    />
  )
}
