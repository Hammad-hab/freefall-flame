import { getDataset, getAllRows, type DataRow, type DatasetMeta } from "@/components/util"
import { DatasetNotFound } from "./components/ui/DatasetNotFound"
import Workspace from "./components/workspace/Workspace"
import type { TabId } from "./components/workspace/layout-reducer"
import { buildRowMapping, parseRows, resolveBass2Columns, type ParsedRow } from "@/lib/combustion"
import { computeShares } from "@/lib/shares"

interface SearchPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const VALID_TABS: readonly TabId[] = ['overview', 'evidence', 'visualization', 'ai-summary', 'papers', 'sandbox']

type LoadedDataset = NonNullable<Awaited<ReturnType<typeof getDataset>>>

/** Shared parsed-row computation for the evidence panels. */
function parseForDataset(dataset: LoadedDataset, rows: DataRow[]): ParsedRow[] {
  return parseRows(rows, buildRowMapping(resolveBass2Columns(dataset.columns).resolutions))
}

export default async function Page({ searchParams }: SearchPageProps) {
  const filters = await searchParams
  const dataset_id = filters.dataset
  const rawTab = filters.tab as string
  const initialTab: TabId = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as TabId)
    : "overview"

  const ds: LoadedDataset | null = await getDataset(dataset_id as string)
  const rows = await getAllRows(dataset_id as string)
  if (!ds) return <DatasetNotFound/>
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
      datasetId={dataset_id as string}
      initialTab={initialTab}
    />
  )
}
