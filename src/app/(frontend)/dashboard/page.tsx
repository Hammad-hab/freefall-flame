import {
  Vulnerability,
  ActiveIncidents,
  Statistics,
  Assistant,
} from "./components/overview/Fragments"
import {getDataset, getAllRows, type DataRow, type DatasetMeta} from "@/components/util"
import Header from "./components/layout/Header";
import { DatasetNotFound } from "./components/ui/DatasetNotFound";
import SummaryAndChart from "./components/overview/SummaryChart"
import Share from "./components/ui/Share"
import InterpretationPanel from "./components/interpretation/InterpretationPanel"
import ReferencedPapers from "./components/papers/ReferencedPapers"
import Visualization from "./components/visualization/Visualization"
import EvidenceRanking from "./components/evidence/EvidenceRanking"
import OxygenHeatmap from "./components/evidence/OxygenHeatmap"
import SourcesStrip from "./components/overview/SourcesStrip"
import Limitations from "./components/overview/Limitations"
import { buildRowMapping, parseRows, resolveBass2Columns, type ParsedRow } from "@/lib/combustion";

interface SearchPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "visualization", label: "Visualization" },
  { id: "ai-summary", label: "Interpretation" },
  { id: "papers", label: "Referenced Papers" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type LoadedDataset = NonNullable<Awaited<ReturnType<typeof getDataset>>>

/** Shared parsed-row computation for the evidence panels. */
function parseForDataset(dataset: LoadedDataset, rows: DataRow[]): ParsedRow[] {
  return parseRows(rows, buildRowMapping(resolveBass2Columns(dataset.columns).resolutions));
}

export default async function Page({ searchParams }: SearchPageProps) {
  const filters = await searchParams;
  const dataset_id = filters.dataset;
  const rawTab = filters.tab as string;
  const activeTab: TabId = (TABS as readonly { id: string }[]).some((t) => t.id === rawTab)
    ? (rawTab as TabId)
    : "overview";

  const ds: LoadedDataset | null = await getDataset(dataset_id as string)
  const rows = await getAllRows(dataset_id as string)
  if (!ds) return <DatasetNotFound/>
  const dataset: DatasetMeta = ds
  return (
      <div className="w-full bg-[#131318] p-8 pb-10 shadow-2xl">
        <Header activeTab={activeTab} />
        <Share
          datasetId={dataset_id as string} metricKey="o2_initial" />
        <div className="mt-10">
          {activeTab === "overview" && (
            <>
              <div className="grid grid-cols-[1fr_380px] gap-8">
                <SummaryAndChart dataset={dataset} rows={rows}/>
                <Vulnerability />
              </div>
              <div className="mt-8 grid grid-cols-[1.45fr_0.8fr_1fr] gap-8">
                <ActiveIncidents />
                <Statistics />
                <Assistant />
              </div>
              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <SourcesStrip dataset={dataset} rows={rows} />
                <Limitations />
              </div>
            </>
          )}
          {activeTab === "evidence" && (
            <>
              <EvidenceRanking rows={parseForDataset(dataset, rows)} />
              <div className="mt-6">
                <OxygenHeatmap rows={parseForDataset(dataset, rows)} />
              </div>
              <div className="mt-6">
                <Limitations />
              </div>
            </>
          )}
          {activeTab === "ai-summary" && (
            <InterpretationPanel datasetId={dataset_id as string} datasetName={ds.name} />
          )}
          {activeTab === "papers" && (
            <ReferencedPapers papers={ds.papers} />
          )}
          {activeTab === "visualization" && (
            <Visualization dataset={dataset} rows={rows} />
          )}
        </div>
      </div>
  );
}
