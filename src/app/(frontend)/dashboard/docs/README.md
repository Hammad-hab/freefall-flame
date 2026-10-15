# Dashboard Documentation

The BASS-II fire-safety dashboard is a read-only, data-driven web interface
for exploring combustion experiment data collected aboard the International
Space Station. It presents material evidence rankings, oxygen-coverage
heatmaps, gas-composition charts, and AI-assisted interpretations — all
grounded in the measured dataset and its linked research papers.

## Quick Start

```bash
pnpm dev          # start the dev server
pnpm build        # production build
pnpm test         # run unit + e2e tests
```

The dashboard is served at `/dashboard?dataset=<id>` and requires at least
one published dataset in the Payload CMS backend.

## Directory Structure

```
dashboard/
  page.tsx                    Entry point — loads dataset, renders active tab
  layout.tsx                  Shared shell (dark background, max-width container)
  components/
    layout/
      Header.tsx              Top bar with tab navigation and search icon
    ui/
      Card.tsx                Card, Icon, Arrow primitives
      chart-theme.tsx         Shared color tokens, panel styles, SectionLabel
      Share.tsx               Dataset share-link component
      DatasetNotFound.tsx     404 state with confused-dragon illustration
    overview/
      SummaryChart.tsx        Dataset summary + column/row preview tabs
      SourcesStrip.tsx        Dataset-wide papers + row-level provenance
      Limitations.tsx         Scope & limitations panel (scientific guardrails)
      Fragments.tsx           Template placeholder panels (Vulnerability, etc.)
    evidence/
      EvidenceRanking.tsx     Material evidence-coverage ranking table
      OxygenHeatmap.tsx       Materials × O₂-concentration band heatmap
    visualization/
      Visualization.tsx       Main charts (bar, scatter) + data table
      GenericCompare.tsx      Generic scatter plot for any two numeric columns
    interpretation/
      InterpretationPanel.tsx AI-assisted interpretation with grounded summary
    papers/
      ReferencedPapers.tsx     List of papers linked to the dataset
  lib/
    combustion.ts             Pure BASS-II logic (column resolution, scoring, …)
  docs/
    README.md                 This file
    architecture.md           System architecture and data flow
    components.md             Component-by-component reference
    data-flow.md              How data moves from CSV to chart
```

## Technology Stack

| Layer      | Technology                                  |
| ---------- | ------------------------------------------- |
| Framework  | Next.js 16 (App Router, React Server Components) |
| CMS        | Payload 3.0 (Postgres)                      |
| Styling    | Tailwind CSS 4                              |
| Charts     | Recharts 3                                  |
| Language   | TypeScript 5                                |

## Key Design Decisions

1. **Server-side data fetching** — All dataset and row fetching happens in
   React Server Components (`page.tsx`) via `src/components/util.ts`. Client
   components receive plain data props, never raw Payload documents.

2. **Pure logic separation** — Every computation (column resolution, row
   parsing, evidence scoring, O₂ band derivation) lives in
   `lib/combustion.ts` as a pure, framework-free module. This makes the
   logic unit-testable without React, Payload, or a browser.

3. **Evidence, not risk** — The dashboard explicitly avoids fire-risk or
   safety ratings. Evidence scores measure how much the dataset tells us
   about a material, never how dangerous it is.

4. **Censored readings preserved** — Sensor readings that are out-of-range
   or censored are never silently treated as zero or missing. They are
   classified, counted, and displayed with their original source text.

5. **Column resolution is deterministic** — BASS-II column roles (material,
   O₂ initial/final, CO, CO₂, etc.) are resolved through a documented
   pipeline: admin canonical mapping → exact key → exact label → unique
   fuzzy substring. Ambiguities are flagged, never guessed.

## Environment Variables

| Variable       | Purpose                                    |
| -------------- | ------------------------------------------ |
| `DATABASE_URI` | Postgres connection string for Payload     |
| `PAYLOAD_SECRET` | Payload encryption secret                |
| `OPENROUTER_API_KEY` | (Optional) AI interpretation service    |

See `.env.example` for the full list.
