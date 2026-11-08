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
import { Statistics, Assistant } from '../overview/Fragments'
import KeyNumbers from '../overview/KeyNumbers'
import { AboutDataset, MaterialsCard, ScorecardCard } from '../overview/OverviewCards'
import { OutcomeChart } from '../visualization/MaterialCharts'
import { outcomeCounts } from '../visualization/chartData'
import SourcesStrip from '../overview/SourcesStrip'
import Limitations from '../overview/Limitations'
import EvidenceRanking from '../evidence/EvidenceRanking'
import OxygenHeatmap from '../evidence/OxygenHeatmap'
import Visualization from '../visualization/Visualization'
import InterpretationPanel from '../interpretation/InterpretationPanel'
import ReferencedPapers from '../papers/ReferencedPapers'
import Sandbox from '../sandbox/sandbox'
import Investigations from '../investigations/Investigations'
import Customize from '../customize/Customize'
import { linkProps, type WorkspaceLinks } from './links'
<<<<<<< HEAD
import ChatUI from '../chat/chatui'
=======
import { C } from '../ui/chart-theme'
>>>>>>> refs/remotes/origin/dev

/** What every tab can use: the server's data, plus the workspace's links between tabs. */
export interface TabData {
  dataset: DatasetMeta
  rows: DataRow[]
  parsedRows: ParsedRow[]
  shares: ShareResult
  datasetId: string
  datasetName: string
  links?: WorkspaceLinks
}

function OverviewContent({ data }: { data: TabData }) {
  return (
    <div className="space-y-4">
      {/* Dataset title heading */}
      <div className="flex items-start gap-3">
        <h1 className="text-[18px] font-light leading-tight" style={{ color: C.fg }}>
          {data.datasetName}
        </h1>
      </div>
      {data.links && (
        <p className="text-[12px]" style={{ color: C.muted }}>
          <a
            {...linkProps(data.links.cardHref('bass-ii'), () => data.links!.showCard('bass-ii'))}
            data-link-investigations
            className="underline decoration-dotted underline-offset-2 hover:opacity-80"
            style={{ color: C.accentText }}
          >
            How BASS-II ranks among NASA&apos;s 14 PSI combustion investigations for habitat fire safety
          </a>
        </p>
      )}
      {/* feat/ui-visuals: judge-facing cards first; the developer-style ones folded into "About this dataset". */}
      <div className="grid grid-cols-1 gap-8 @4xl:grid-cols-[1fr_380px]">
        <OverviewOutcomes rows={data.parsedRows} />
        <KeyNumbers rows={data.parsedRows} links={data.links} />
      </div>
      <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-2">
        <MaterialsCard rows={data.parsedRows} />
        <ScorecardCard total={data.rows.length} links={data.links} />
      </div>
      <Assistant datasetId={data.datasetId} datasetName={data.datasetName} />
      <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-2">
        <SourcesStrip dataset={data.dataset} rows={data.rows} />
        <Limitations />
      </div>
      <AboutDataset>
        <SummaryAndChart dataset={data.dataset} rows={data.rows} />
        <Statistics shares={data.shares} />
      </AboutDataset>
    </div>
  )
}

/** NASA's stated outcomes, the Visualization tab's chart; nothing when the dataset has no outcome column. */
function OverviewOutcomes({ rows }: { rows: ParsedRow[] }) {
  const data = outcomeCounts(rows)
  return data.length ? <div id="overview-outcomes"><OutcomeChart data={data} /></div> : null
}

function EvidenceContent({ data }: { data: TabData }) {
  return (
    <div className="space-y-6">
      <EvidenceRanking rows={data.parsedRows} />
      <OxygenHeatmap rows={data.parsedRows} rawRows={data.rows} />
      <Limitations />
    </div>
  )
}

function VisualizationContent({ data }: { data: TabData }) {
  return <Visualization dataset={data.dataset} rows={data.rows} links={data.links} />
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
  investigations: {
    label: 'Investigations',
    icon: 'M4 6h16M4 12h10M4 18h6M17 14l2 2 3-4',
    render: (d) => <Investigations links={d.links} />,
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
  // 'ai-summary': {
  //   label: 'Interpretation',
  //   icon: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.7 1 1.5 1 2.5h6c0-1 .2-1.8 1-2.5A6 6 0 0012 3z',
  //   render: (d) => <AiSummaryContent data={d} />,
  // },
  papers: {
    label: 'Referenced Papers',
    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6',
    render: (d) => <PapersContent data={d} />,
  },
  sandbox: {
    label: 'Sandbox',
    icon: 'M9 3h6M10 3v6L4.5 18.5A2 2 0 006.4 21.5h11.2a2 2 0 001.9-3L14 9V3M7 15h10',
    render: (d) => <Sandbox dataset={d.dataset} rows={d.rows} links={d.links} />,
  },
  'ai-summary': {
    label: 'Interpretation',
    icon: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.7 1 1.5 1 2.5h6c0-1 .2-1.8 1-2.5A6 6 0 0012 3z',
    render: (d) => <ChatUI />
  },
  customize: {
    label: 'Customize',
    icon: 'M12 3a9 9 0 100 18c.8 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1-.3-.3-.4-.7-.4-1 0-.8.7-1.5 1.5-1.5H16a5 5 0 005-5c0-4.4-4-8-9-8zM7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01M16.5 11h.01',
    render: () => <Customize />,
  },
}

/** The data tabs, in the sidebar's order. Customize sits apart, at the sidebar's foot. */
export const TAB_ORDER: TabId[] = ['overview', 'investigations', 'evidence', 'visualization', 'ai-summary', 'papers', 'sandbox']
