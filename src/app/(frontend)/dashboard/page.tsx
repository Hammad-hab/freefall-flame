import {
  Vulnerability,
  ActiveIncidents,
  Statistics,
  Assistant,
} from "./components/Fragments"
import {getDataset, getAllRows} from "@/components/util"
import Header from "./components/Header";
import { DatasetNotFound } from "./components/DatasetNotFound";
import SummaryAndChart from "./components/SummaryChart"
import Share from "./components/Share"
import AISummary from "./components/AISummary";
import ReferencedPapers from "./components/ReferencedPapers";
import Visualization from "./components/Visualization";
interface SearchPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const VALID_TABS = ["Overview", "AI Summary", "Referenced Papers", "Visualization"] as const;
type TabName = (typeof VALID_TABS)[number];

export default async function Page({ searchParams }: SearchPageProps) {
  const filters = await searchParams;
  const dataset_id = filters.dataset;
  const rawTab = filters.tab as string;
  const activeTab: TabName = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as TabName)
    : "Overview";

  const ds = await getDataset(dataset_id as string)
  const rows = await getAllRows(dataset_id as string)
  if (!ds) return <DatasetNotFound/>

  return (
      <div className="w-full bg-[#131318] p-8 pb-10 shadow-2xl">
        <Header activeTab={activeTab} />
        {/*<div className="mt-6">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">{ds.name}</h1>
         
        </div>*/}
        <Share
          datasetId={dataset_id as string} metricKey="o2_initial" />
        <div className="mt-10">
          {activeTab === "Overview" && (
            <>
              <div className="grid grid-cols-[1fr_380px] gap-8">
                <SummaryAndChart dataset={ds} rows={rows}/>
                <Vulnerability />
              </div>
              <div className="mt-8 grid grid-cols-[1.45fr_0.8fr_1fr] gap-8">
                <ActiveIncidents />
                <Statistics />
                <Assistant />
              </div>
            </>
          )}
          {activeTab === "AI Summary" && (
            <AISummary datasetId={dataset_id as string} datasetName={ds.name} />
          )}
          {activeTab === "Referenced Papers" && (
            <ReferencedPapers papers={ds.papers} />
          )}
          {activeTab === "Visualization" && (
            <Visualization dataset={ds} rows={rows} />
          )}
        </div>
      </div>
  );
}
