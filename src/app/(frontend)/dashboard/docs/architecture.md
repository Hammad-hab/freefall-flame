# Architecture

## Overview

The dashboard follows a server-component-first architecture. Data is fetched
on the server, transformed into plain JavaScript objects, and passed to
client components for interactive rendering.

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Client Components)                            │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Header      │  │ Evidence     │  │ Visualization │  │
│  │ (tabs)      │  │ Ranking      │  │ (charts)      │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│         └────────────────┴───────────────────┘          │
│                          │ plain data props              │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│  Server (page.tsx — React Server Component)             │
│                          │                              │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │ src/components/util.ts                            │  │
│  │  getDataset() → Payload CMS → DatasetMeta         │  │
│  │  getAllRows() → Payload CMS → DataRow[]           │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │ src/lib/combustion.ts (pure logic)                │  │
│  │  resolveBass2Columns() → ColumnResolution         │  │
│  │  buildRowMapping() → RowMapping                   │  │
│  │  parseRows() → ParsedRow[]                        │  │
│  │  computeMaterialMetrics() → MaterialMetrics[]     │  │
│  │  computeEvidenceScores() → ScoredMaterial[]       │  │
│  │  deriveO2Bands() → O2Band[]                       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│  Payload CMS (Postgres)                                  │
│  collections: Datasets, DatasetRows, Papers, Users      │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Dataset Loading

`page.tsx` (server component) calls `getDataset(id)` and `getAllRows(id)`
from `src/components/util.ts`. These functions use Payload's local API with
`overrideAccess: false` to enforce the published-only access rule. Results
are cached with `unstable_cache` (60-second revalidation).

### 2. Column Resolution

The dataset's column definitions are passed to `resolveBass2Columns()` in
`lib/combustion.ts`. This resolves logical roles (material, O₂ initial/final,
CO, CO₂, thickness, flow restrictor, air velocity, PI, etc.) to physical
column keys through a deterministic pipeline:

1. Admin-configured canonical mapping (`canonicalField`)
2. Exact source-column key match
3. Exact (case-insensitive) label match
4. Unique fuzzy substring match (flagged ambiguous when not unique)

### 3. Row Parsing

`parseRows()` takes the raw `DataRow[]` and the resolved `RowMapping`,
classifying each gas reading as `valid`, `missing`, `censored`, `outOfRange`,
or `invalid`. O₂ consumption is only computed when initial and final readings
are independently resolved to *different* columns and both are valid.

### 4. Metrics & Scoring

`computeMaterialMetrics()` groups parsed rows by material and computes:
- Test count, distinct O₂ conditions, O₂ range
- Mean O₂ consumed, mean CO produced, mean CO₂ produced
- Count of excluded (censored/out-of-range/missing) readings

`computeEvidenceScores()` normalizes each component (test coverage, O₂
diversity, O₂ range) against the best-covered material, applies adjustable
weights, and produces a competition ranking. Missing components are excluded
and remaining weights renormalized — missing evidence is not zero coverage.

### 5. Client-Side Rendering

Client components receive `ParsedRow[]`, `DatasetMeta`, and `DataRow[]` as
props. They use `useMemo` for derived chart data and `useState` for
interactive controls (filters, sort mode, weight sliders, band width).

## API Routes

| Route                        | Purpose                              |
| ---------------------------- | ------------------------------------ |
| `/api/interpretation`        | Grounded summary for AI panel        |
| `/api/openrouter`            | AI interpretation via OpenRouter      |

Both routes use the same `lib/combustion.ts` functions to build their
summaries, ensuring consistency between client and server computations.

## Caching Strategy

- **Dataset metadata**: `unstable_cache` with 60-second revalidation,
  tagged `datasets` and `dataset-<id>`
- **Dataset bundle** (metadata + rows): `unstable_cache` keyed by dataset ID,
  tagged for on-demand revalidation
- **Client-side**: `useMemo` for all derived computations; no SWR or
  React Query needed since data is fetched once per page load

## Security

- All Payload queries use `overrideAccess: false` to enforce collection-level
  access control
- Only published datasets are visible to the public
- The AI interpretation endpoint never exposes raw rows — only aggregates
- No authentication is required for the read-only dashboard; write operations
  are handled by the Payload admin panel
