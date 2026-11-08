import {
  getDataset,
  getAllRows,
  getPublishedDatasets,
  getPublishedDatasetsUncached,
  type DataRow,
  type DatasetMeta,
} from "@/components/util"
import { DatasetNotFound } from "./components/ui/DatasetNotFound"
import { DataUnavailable } from "./components/ui/DataUnavailable"
import { loadDashboard } from "./load"
import Workspace from "./components/workspace/Workspace"
import type { TabId } from "./components/workspace/layout-reducer"
import { buildRowMapping, parseRows, resolveBass2Columns, type ParsedRow } from "@/lib/combustion"
import { computeShares } from "@/lib/shares"
import { cleanCardId, cleanGroup, cleanTestId } from "./components/workspace/links"

interface SearchPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const VALID_TABS: readonly TabId[] = ['overview', 'investigations', 'evidence', 'visualization', 'ai-summary', 'papers', 'sandbox', 'customize']

/** Shared parsed-row computation for the evidence panels. */
function parseForDataset(dataset: DatasetMeta, rows: DataRow[]): ParsedRow[] {
  return parseRows(rows, buildRowMapping(resolveBass2Columns(dataset.columns).resolutions))
}

export default async function Page({ searchParams }: SearchPageProps) {
  const filters = await searchParams
  const dataset_id = filters.dataset
  const rawTab = filters.tab as string
  const initialTab: TabId = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as TabId)
    : "overview"

  // load.ts: a bad id is "not found" before any query; a database that can't
  // be reached gives the friendly page instead of a raw HTTP 500.
  const loaded = await loadDashboard(dataset_id, {
    published: getPublishedDatasets,
    publishedUncached: getPublishedDatasetsUncached,
    dataset: getDataset,
    rows: getAllRows,
  })
  if (loaded.kind === 'notFound') return <DatasetNotFound requested={typeof dataset_id === 'string' ? dataset_id : undefined}/>
  if (loaded.kind === 'unavailable') {
    console.error('[dashboard] could not reach the data:', (loaded.error as Error)?.message ?? loaded.error)
    return <DataUnavailable/>
  }
  const { datasetId, dataset, rows } = loaded

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
      initialMoon={initialTab === 'sandbox' && filters.scenario === 'moon'}
      initialTest={cleanTestId(filters.test)}
      initialCard={initialTab === 'investigations' ? cleanCardId(filters.card) : null}
    />
  )
}
