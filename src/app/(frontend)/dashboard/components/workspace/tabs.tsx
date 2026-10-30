/**
 * Tab registry — maps each TabId to its label, icon, and render function.
 * Adding a new tab later is one entry here.
 *
 * The render functions return ReactNode so this module is a client module,
 * but it is only ever imported by client components (Workspace), never by
 * the server component (page.tsx).
 */
import type { ReactNode } from 'react'
import type { TabId } from './layout-reducer'
import type { DatasetMeta, DataRow } from '@/lib/types'
import type { ParsedRow } from '@/lib/combustion'
import type { ShareResult } from '@/lib/shares'
import SummaryAndChart from '../overview/SummaryChart'
import { Vulnerability, Statistics, Assistant } from '../overview/Fragments'
import SourcesStrip from '../overview/SourcesStrip'
import Limitations from '../overview/Limitations'
import EvidenceRanking from '../evidence/EvidenceRanking'
import OxygenHeatmap from '../evidence/OxygenHeatmap'
import Visualization from '../visualization/Visualization'
import InterpretationPanel from '../interpretation/InterpretationPanel'
import ReferencedPapers from '../papers/ReferencedPapers'
import Sandbox from '../sandbox/sandbox'

/** Serializable props passed from the server component to the workspace. */
export interface TabData {
  dataset: DatasetMeta
  rows: DataRow[]
  parsedRows: ParsedRow[]
  shares: ShareResult
  datasetId: string
  datasetName: string
}

function OverviewContent({ data }: { data: TabData }) {
  return (
    <div className="space-y-8">
      {/* Container-query variants, not viewport ones: the overview renders inside a
          resizable pane, so its columns must follow the pane's width. A 400px pane on a
          1920px screen must still stack. */}
      <div className="grid grid-cols-1 gap-8 @4xl:grid-cols-[1fr_380px]">
        <SummaryAndChart dataset={data.dataset} rows={data.rows} />
        <Vulnerability />
      </div>
      <div className="grid grid-cols-1 gap-8 @2xl:grid-cols-2 @6xl:grid-cols-[1.45fr_0.8fr_1fr]">
        <Statistics shares={data.shares} />
        <Assistant data={data} />
      </div>
      <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-2">
        <SourcesStrip dataset={data.dataset} rows={data.rows} />
        <Limitations />
      </div>
    </div>
  )
}

function EvidenceContent({ data }: { data: TabData }) {
  return (
    <div className="space-y-6">
      <EvidenceRanking rows={data.parsedRows} />
      <OxygenHeatmap rows={data.parsedRows} />
      <Limitations />
    </div>
  )
}

function VisualizationContent({ data }: { data: TabData }) {
  return <Visualization dataset={data.dataset} rows={data.rows} />
}

function AiSummaryContent({ data }: { data: TabData }) {
  return (
    <div className="space-y-8">
      <InterpretationPanel datasetId={data.datasetId} datasetName={data.datasetName} />
      <ReferencedPapers papers={data.dataset.papers} />
    </div>
  )
}

function PapersContent({ data }: { data: TabData }) {
  return <ReferencedPapers papers={data.dataset.papers} />
}

export const TAB_REGISTRY: Record<
  TabId,
  { label: string; icon: string; render: (data: TabData) => ReactNode }
> = {
  overview: {
    label: 'Overview',
    icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    render: (d) => <OverviewContent data={d} />,
  },
  evidence: {
    label: 'Evidence',
    icon: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z',
    render: (d) => <EvidenceContent data={d} />,
  },
  visualization: {
    label: 'Visualization',
    icon: 'M4 20V10M10 20V4M16 20v-7',
    render: (d) => <VisualizationContent data={d} />,
  },
  'ai-summary': {
    label: 'Interpretation',
    icon: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.7 1 1.5 1 2.5h6c0-1 .2-1.8 1-2.5A6 6 0 0012 3z',
    render: (d) => <AiSummaryContent data={d} />,
  },
  papers: {
    label: 'Referenced Papers',
    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6',
    render: (d) => <PapersContent data={d} />,
  },
  sandbox: {
    label: 'Sandbox',
    icon: 'M9 3h6M10 3v6L4.5 18.5A2 2 0 006.4 21.5h11.2a2 2 0 001.9-3L14 9V3M7 15h10',
    render: () => <Sandbox />,
  },
}

export const TAB_ORDER: TabId[] = ['overview', 'evidence', 'visualization', 'ai-summary', 'papers', 'sandbox']
