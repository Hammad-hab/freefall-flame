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
import Share from "./components/Share";
interface SearchPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ searchParams }: SearchPageProps) {
  const filters = await searchParams;
  const dataset_id = filters.dataset
  const ds = await getDataset(dataset_id as string)
  const rows = await getAllRows(dataset_id as string)
  // const dataset = 
  if (!ds) return <DatasetNotFound/>
  
  return (
      <div className="w-full bg-[#131318] p-8 pb-10 shadow-2xl">
        <Header tabs={["Overview", "AI Summary", "Referenced Papers", "Visualization"]} />
        <Share
          datasetId={dataset_id as string} metricKey="o2_initial" />
        <div className="mt-10 grid grid-cols-[1fr_380px] gap-8">
          <SummaryAndChart dataset={ds} rows={rows}/>
          <Vulnerability />
        </div>
        <div className="mt-8 grid grid-cols-[1.45fr_0.8fr_1fr] gap-8">
          <ActiveIncidents />
          <Statistics />
          <Assistant />
        </div>
      </div>
  );
}