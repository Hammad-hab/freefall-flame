# Component Reference

## Entry Point

### `page.tsx`

The dashboard's React Server Component. Loads the dataset and all rows,
resolves columns, parses rows, and renders the active tab.

**Props:** `searchParams: Promise<{ dataset?: string; tab?: string }>`

**Tabs:**

| Tab ID         | Label            | Components Rendered                                      |
| -------------- | ---------------- | -------------------------------------------------------- |
| `overview`     | Overview         | SummaryChart, Vulnerability, ActiveIncidents, Statistics, Assistant, SourcesStrip, Limitations |
| `evidence`     | Evidence         | EvidenceRanking, OxygenHeatmap, Limitations              |
| `visualization`| Visualization    | Visualization                                            |
| `ai-summary`   | Interpretation   | InterpretationPanel                                      |
| `papers`       | Referenced Papers| ReferencedPapers                                         |

---

## Layout Components

### `layout/Header.tsx`

Client component. Renders the "Freefall labs" brand, tab navigation pills,
and a search icon button. Uses `useRouter` and `useSearchParams` from
`next/navigation` for tab switching without page reloads.

**Props:** `activeTab: TabId`

---

## UI Primitives

### `ui/Card.tsx`

Exports `Card`, `Icon`, and `Arrow` — the basic visual building blocks.

- **`Card`** — rounded container with border and background
- **`Icon`** — SVG icon renderer (takes a `d` path string)
- **`Arrow`** — diagonal arrow icon (top-right)

### `ui/chart-theme.tsx`

Shared design tokens and panel styles:

- **`C`** — color constants (ink, panel, chip, fg, muted, blue, amber, pink, green, violet, red)
- **`CHART_COLORS`** — array of chart accent colors
- **`panelCls`** — Tailwind class string for panel styling
- **`panelStyle`** — inline style object for panel borders/backgrounds
- **`SectionLabel`** — small uppercase section label component

### `ui/Share.tsx`

Server component. Renders the dataset name, description, row count pills,
and mean metric stats. Used at the top of the dashboard.

**Props:** `datasetId: string, metricKey?: string`

### `ui/DatasetNotFound.tsx`

Renders a 404 state with an SVG confused-dragon illustration and a link back
to the home page.

---

## Overview Tab

### `overview/SummaryChart.tsx`

Client component. Two-panel card with dataset metadata (column count, last
updated) on the left and a tabbed view (Columns list / Dataset preview table)
on the right.

**Props:** `dataset: DatasetMeta | null, rows: DataRow[]`

### `overview/SourcesStrip.tsx`

Client component. Lists dataset-wide papers with NTRS links, plus row-level
paper provenance counts. Unresolved paper IDs are reported, not dropped.

**Props:** `dataset: DatasetMeta, rows: DataRow[]`

### `overview/Limitations.tsx`

Client component. Static panel explaining the scientific scope and limitations
of the BASS-II dataset. Rendered on both Overview and Evidence tabs.

### `overview/Fragments.tsx`

Template placeholder panels (Vulnerability, ActiveIncidents, Statistics,
Assistant). These appear to be from a design template and are not wired to
real data. They are preserved for visual reference.

---

## Evidence Tab

### `evidence/EvidenceRanking.tsx`

Client component. Ranks materials by evidence coverage using an adjustable
weighted scoring formula. Features:

- Three weight sliders (Test Coverage, O₂ Condition Diversity, O₂ Range)
- Sort control (Rank, Name, Tests, Score)
- Full ranking table with per-component breakdown
- Transparent scoring formula explanation

**Props:** `rows: ParsedRow[]`

**Scoring Formula:**
```
Evidence Score = w₁·TestCoverage + w₂·O₂Diversity + w₃·O₂RangeCoverage
```
Each component is normalized 0–100 against the best-covered material. Weights
are normalized to sum to 1. Missing components are excluded and remaining
weights renormalized.

### `evidence/OxygenHeatmap.tsx`

Client component. Materials × O₂-concentration band heatmap. Features:

- Adjustable band width (1%, 2%, 3% O₂)
- Sort control (Evidence score, Name, Test count)
- Color-coded cells showing test count
- Separate column for rows without valid O₂ readings
- Legend explaining filled/empty/amber cells

**Props:** `rows: ParsedRow[]`

---

## Visualization Tab

### `visualization/Visualization.tsx`

Client component. The main charting panel. Features:

- Material and flow restrictor filters
- Stat cards with sample sizes (n)
- Bar charts: Tests per Material, Mean O₂/CO/CO₂ by Material
- Grouped bar charts: O₂ and CO₂ Before vs After Tests
- Scatter plot: Starting Air Velocity vs O₂ Consumed
- Bar chart: Thickness Distribution
- Bar chart: Tests by Principal Investigator
- Data table with censored/out-of-range markers
- Graceful degradation when BASS-II columns are missing

**Props:** `dataset: DatasetMeta, rows: DataRow[]`

### `visualization/GenericCompare.tsx`

Client component. Generic scatter plot that works with any dataset having at
least two numeric columns. Features:

- X/Y axis selectors (any numeric columns)
- Group-by selector (any category column)
- Empty states for insufficient columns or no matching rows
- Skipped-row counter

**Props:** `dataset: DatasetMeta, rows: DataRow[]`

---

## Interpretation Tab

### `interpretation/InterpretationPanel.tsx`

Client component. "What Do These Results Tell Us?" panel. Features:

- Material filter dropdown
- Deterministic observations (always present)
- AI-assisted interpretation (when `OPENROUTER_API_KEY` is configured)
- Deterministic fallback interpretation (when no AI is configured)
- Uncertainties section
- Linked research sources with NTRS links

**Props:** `datasetId: string, datasetName: string`

**Data source:** `/api/interpretation?dataset=<id>&material=<name>`

---

## Papers Tab

### `papers/ReferencedPapers.tsx`

Client component. Simple list of papers linked to the dataset, each showing
title, NTRS ID badge, and source link.

**Props:** `papers: PaperRef[]`
