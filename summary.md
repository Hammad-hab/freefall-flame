# Flame in Freefall — Microgravity Combustion Dashboard
## Analysis Summary
### (Project root: `Combustion/` ; dashboard app source: `src/app/(frontend)/dashboard/`)

This document analyses the "dashboard" in this repository: a read-only, data-driven web
interface for exploring NASA microgravity combustion experiment data (BASS-II and others)
collected aboard the International Space Station. It presents material evidence rankings,
oxygen-coverage heatmaps, gas-composition charts, and AI-assisted interpretations, all
grounded in the loaded datasets and their linked papers.

---

## 1. What the dashboard actually is

- A **Next.js 16 App Router** site (React Server Components) + **Payload 3.0** headless CMS
  (Postgres backend) + **Tailwind CSS 4** + **Recharts 3** + **Three.js** background.
- The public-facing product is branded **"Flame in Freefall"** (home page title in
  `src/app/(frontend)/page.tsx`). The dashboard is served at `/dashboard?dataset=<id>`.
- It is **read-only** for visitors. Write operations (upload CSV, edit columns, add papers)
  live in the Payload admin panel, not in the dashboard UI.
- The dashboard's single server entry point is
  `src/app/(frontend)/dashboard/page.tsx`, which resolves the dataset, fetches all rows,
  resolves the combustion column mapping, parses the rows, computes row-shares, and renders
  the Workspace (the tabbed main area).

The product has two surface levels:

1. **Home page** — marketing/intro screen with the four "Explore / Compare / Rank / Ask"
   pillars, the three NASA data sources (PSI, NTRS, Task Book), a "Bring your own dataset"
   explainer, and a footer disclaimer (built for NASA Space Apps Challenge 2026; not
   affiliated with NASA).
2. **Dashboard** — the data analysis surface. Its layout is a JupyterLab-style resizable
   workspace with a sidebar of tabs and a flexible pane tree.

---

## 2. Technology stack

| Layer |Technology|
|---|---|
| Framework | Next.js 16 (App Router, RSC), React 19 |
| CMS | Payload 3.0 (Postgres `@payloadcms/db-postgres`) |
| Storage | S3-compatible object storage (`@payloadcms/storage-s3`) |
| Styling | Tailwind CSS 4 (`@tailwindcss/postcss`) |
| Charts | Recharts 3 (`^3.10.1`) |
| Background | Three.js (`^0.186.1`) — Shadertoy-derived raymarcher |
| Language | TypeScript 5.7 |
| CSV import | PapaParse (`papaparse`) |
| Build/test | pnpm, vitest (unit), Playwright (E2E) |

Environment variables actually in use
(`.env` in the repo root, not shown to the public):
`PAYLOAD_SECRET`, `DATABASE_URL` (a Supabase Postgres pooler endpoint), `OPEN_ROUTER`
(OpenRouter AI key, used only by an optional interpretation endpoint).

---

## 3. Architecture

### 3.1 Data flow (CSV → chart)

1. **CSV import (admin).** An admin uploads a CSV under *Dataset Imports*. The importer
   (`src/scripts/import-csv.ts`) parses the CSV, **infers** the column schema (type, unit,
   role, required columns, junk values), validates every row against it, and creates
   `Dataset` + `DatasetRows` documents in Postgres. Non-numeric entries that are censored /
   out-of-range markers (`>500`, `OR`, `sat`) are stored as `null` with the original text in
   `rawData` so the dashboard can report them instead of silently treating them as blanks.
2. **Dataset loading (server).** `page.tsx` (a server component) calls
   `getDataset(id)` and `getAllRows(id)` from `src/components/util.ts`. Both use Payload's
   local API with `overrideAccess: false` to enforce the published-only access rule
   (public readers see only `published: true` datasets). Results are cached with
   `unstable_cache` (60s revalidation).
3. **Column resolution.** The dataset's column definitions are passed to
   `resolveBass2Columns()` in `src/lib/combustion.ts`. Each logical role (material,
   o2Initial, o2Final, coInitial, co2Final, thickness, flowRest, airVel, pi, date) is
   resolved deterministically:
   admin canonical mapping → exact column key → exact label → unique fuzzy substring
   (a non-unique fuzzy match is flagged as an ambiguity, never silently guessed).
4. **Row parsing.** `parseRows()` classifies every gas reading as one of
   `valid | missing | censored | outOfRange | invalid`. O₂ consumed is computed **only**
   when initial and final readings are independent, valid, different columns
   (`o2i - o2f`). CO/CO₂ produced are computed similarly. Censored/out-of-range values are
   never treated as zero or as a number.
5. **Metrics & scoring.** `computeMaterialMetrics()` groups rows by material and computes
   test count, distinct O₂ conditions, O₂ range, means, and excluded-reading counts.
   `computeEvidenceScores()` normalises each component against the best-covered material,
   applies adjustable weights, and produces a competition ranking (tied scores share a rank).
6. **Client rendering.** Client components receive plain data props (no Payload documents)
   and use `useMemo`/`useState` for derived data and interactivity.

### 3.2 Component tree (per tab)

The workspace is a tree of **Leaf** (pane + tab strip) and **Split** nodes managed by a
pure, unit-tested reducer (`layout-reducer.ts`). The sidebar lists tabs; clicking a tab
opens it in the focused pane (or a new leaf on the right via the split button).

| Tab ID | Label | Rendered by |
|---|---|---|
| `overview` | Overview | `OverviewContent` → `SummaryChart`, `Vulnerability`, `ActiveIncidents`, `Statistics`, `Assistant`, `SourcesStrip`, `Limitations` |
| `evidence` | Evidence | `EvidenceRanking`, `OxygenHeatmap`, `Limitations` |
| `visualization` | Visualization | `Visualization.tsx` (orchestrator) + `chartData.ts`, `MaterialCharts.tsx`, `GasCharts.tsx`, `DataTable.tsx`, `GenericCompare.tsx` |
| `ai-summary` | Interpretation | `InterpretationPanel` + `ReferencedPapers` |
| `papers` | Referenced Papers | `ReferencedPapers` |
| `sandbox` | Sandbox | `sandbox.tsx` + `GridCanvas`, `Engine`, `Controls`, `PresetsPanel` |

---

## 4. Data model (Payload collections)

| Collection | Purpose | Key access rules |
|---|---|---|
| `datasets` | One dataset: `name`, `description`, `columns[]` (label/key/type/unit/canonicalField/options/required/csvHeader), `rowCount`, `lastImportedAt`, `papers[]` | Public read only when `published` |
| `dataset-rows` | Flat CSV rows as `data` JSON keyed by column key, plus `rowIndex`, `sourcePaper`, `sourcePage`, `rawData` (original non-numeric text) | Public read only when the parent dataset is published |
| `dataset-imports` | CSV upload; validates against the dataset's columns; supports `replace`, `checkOnly` | Admin only |
| `papers` | `title`, `authors`, `year`, `documentType`, `ntrsId` (unique, indexed), `doi`, `sourceUrl`, `license`, `experiments` (type + linkStatus), `datasets` join, `abstract`, `fullText` (hidden from public), `ingestStatus` | Public read published only |
| `users` | Auth-enabled (admin panel login) | Admin only |
| `media` | File uploads (S3), minimal `alt` field | Public |

`PaperRef` (frontend type) = `{ id, title, ntrsId?, sourceUrl? }` — the dashboard only ever
exposes title/NTRS/source, never authors/fullText.

Sci.enums referenced in code (mirrors `flame_core.h`): `MAT`, `KIND`, `DIR`, `PARAM`,
`LOG`, `OUTCOME`, `FIDELITY`, `NASA`, `READING`, `LIGHT`, plus `WIND_PER_CM_S`.

---

## 5. The six tabs in detail

### 5.1 Overview
The default tab. Line layout (per `tabs.tsx` `OverviewContent`):

- **`SummaryChart`** (client component in `overview/SummaryChart.tsx`): a two-panel card.
  - Summary panel: "Size of the dataset" = `dataset.columns.length` (number of defined
    columns) and "Last Updated" = `lastImportedAt` formatted as a date.
  - Right panel: a `Columns`/`Dataset` tab switcher. `Columns` lists every column
    (label + unit + type). `Dataset` shows a preview table of the first 4 rows with all
    columns, plus "Showing 4 of N rows" when there are more.
- **`Vulnerability`** (Fragments.tsx): template placeholder — hard-coded text
  ("Encryption ensures supplier data remains consistently secure from breaches") with a
  decorative card stack. Not data-dependent and scientifically unrelated; it is a leftover
  placeholder panel.
- **`ActiveIncidents`** (Fragments.tsx): two hard-coded template cards with no dataset
  relationship — "Tommy White / Fixing: The system failed to send the summary update..." and
  "Elizabeth Belle / Investigating: High error rate in user service and issues", plus a fake
  `INC-0000` timestamp. Template filler.
- **`Statistics`** (Fragments.tsx, real): the **only** overview panel wired to live data.
  Breaks `data.shares` (computed once in `page.tsx` by `computeShares` on the PI column)
  into proportional circles, circle area ∝ share (radius ∝ √share). Falls back to
  "No rows to break down yet." when empty.
- **`Assistant`** (Fragments.tsx): template placeholder — 4 hard-coded action pills
  ("Text assistance", "Automation", "Scheduling", "Smart response") and a placeholder
  "Ask something..." input. No dataset relation.
- **`SourcesStrip`** (overview/SourcesStrip.tsx, real): dataset-wide papers with NTRS links
  plus row-level paper provenance counts. Unresolvable row-level paper IDs are reported as
  "unresolved" rather than dropped.
- **`Limitations`** (overview/Limitations.tsx, real): static scientific guardrails for the
  BASS-II dataset (microgravity ≠ lunar/Martian gravity; gas measurements ≠ fire outcomes;
  excluded censored measurements may bias statistics low; evidence scores are not risk
  scores). Rendered on the Overview and Evidence tabs.

**Practical result:** the Overview tab mixes real data (SummaryChart, Statistics,
SourcesStrip, Limitations) with hard-coded template placeholders
(ActiveIncidents, Vulnerability, Assistant).

### 5.2 Evidence
- **`EvidenceRanking`** (evidence/EvidenceRanking.tsx, real): ranks materials by *evidence
  coverage*, never by fire danger. Default weights
  `testCoverage 0.5 / o2Diversity 0.3 / o2Range 0.2`, adjustable via three sliders
  (0–100, renormalised). Components are normalised 0–100 against the best-covered material;
  a missing component is excluded and the remaining weights renormalised (missing evidence
  is not zero coverage). Displays a full table: Rank, Material, Score, Test Cov., O₂ Div.,
  O₂ Range, Tests, O₂ conditions, O₂ range, Bands covered, Mean O₂ consumed (n), Excluded
  readings. Sortable by rank/name/tests/score; tied scores share a rank.
- **`OxygenHeatmap`** (evidence/OxygenHeatmap.tsx, real): materials × O₂-concentration
  band heatmap. Adjustable band width (1/2/3% O₂), sort by evidence score/name/test
  count. Filled cells = test count; empty cells = evidence gaps, explicitly NOT proof of
  safety; amber = rows without a usable starting O₂ reading.
- **`Limitations`** (same as Overview).

### 5.3 Visualization
Orchestrated by `visualization/Visualization.tsx`, which owns column resolution, material/
flow filters, and all derived chart data (reused from pure `chartData.ts`, no React).

- **Graceful degradation:** charts only render if the resolved BASS-II columns exist
  (`material`, `o2Initial`, `o2Final`); otherwise a plain "Combustion analysis unavailable"
  panel explains exactly which columns are missing and points to the generic comparison.
- **Stat cards** (4-grid): Tests, Mean O₂ consumed, Mean CO produced, Mean CO₂ produced,
  each with `n = valid readings`. A notice lists how many readings were censored/out-of-range.
- **Charts** (2-column grid):
  - Tests per Material (sorted bar)
  - Mean O₂/CO/CO₂ by Material (grouped, each with a per-material `n` + excluded count in
    the tooltip)
  - O₂ Before vs After Tests (amber) and CO₂ Before vs After Tests (green) — separate scales
    (~20% vs ~0.5%)
  - Thickness Distribution (<1 / 1–5 / 5–10 / 10+ bins)
  - Starting Air Velocity vs O₂ Consumed (scatter, n>2)
  - Tests by Principal Investigator
- **`DataTable`** (visualization/DataTable.tsx, real): raw readings; censored/out-of-range
  cells show their original source text (e.g. `>500`) as amber markers, never blanks or
  invented numbers. Shows first 10 of N filtered rows.
- **`GenericCompare`** (visualization/GenericCompare.tsx, real, always enabled): a
  dataset-agnostic scatter plot. X/Y axes = any two numeric columns; "Group by" =
  any category column. Points missing an axis value are skipped and counted, never invented.
  Empty states for datasets with <2 numeric columns or no rows. Plot title
  "Compare Any Two Measurements".

### 5.4 Interpretation (ai-summary)
`interpretation/InterpretationPanel.tsx` (real). Two sections below a material filter dropdown:

- **Deterministic observations** — always present, computed server-side from the compact
  validated summary (`/api/interpretation?dataset=<id>`).
- **AI-assisted interpretation** — shown *only* when `OPEN_ROUTER` is configured;
  the model is named in the heading and the panel warns that AI output is an interpretation
  aid (verified against the measured values and cited papers), not ground truth.
- **Fallback** — when no AI is configured, a deterministic reading is shown and clearly
  labelled ("Not an AI-generated analysis").
- **Uncertainties** and **Linked research sources** (with NTRS links) are always present.

### 5.5 Referenced Papers
`papers/ReferencedPapers.tsx` — simple list of the dataset's linked `PaperRef[]` with title,
NTRS badge, and source link. No row-level provenance here; that lives in SourcesStrip.

### 5.6 Sandbox
`components/sandbox/` — a separate, self-contained mini-app (within the dashboard layout)
built on the `flame_core` WebAssembly module (`engine/flame_core.mjs` → thin TS wrapper
`Engine.ts`). It is **not** tied to the datasets.

- **Engine** (`sandbox/engine/Engine.ts`): thin wrapper around the flame-core C API. Every
  C function is exported with a leading underscore (`_fc_*`); strings return as pointers
  read with `UTF8ToString`. Typed-array views (`Float32Array`/`Uint8Array`) wrap engine
  memory without copying. Holds the material table (AIR, WOOD, FAN, PMMA, SIBAL, NOMEX,
  WAX, ...) with RGB + kind. Methods: `reset`, `step`, `setParam`/`getParam`, `paint`/
  `paintFan`/`erase`/`ignite`/`addHeat`, `summary`, `events`, `outcome`, `log`, `camera`,
  `presetCount`/`preset`/`presetStatus`.
- **GridCanvas** (`view/GridCanvas.tsx`): two `<canvas>`s — a pixel grid (imageData, one
  cell per pixel, `imageRendering: pixelated`) and an overlay (arrows in flow view, brush
  hit radius). Driven by `GridView` which calls `fillView` (pure colorisation) every frame.
- **Controls** (`view/Controls.tsx`): tabs (Build / World / Presets), run bar (Play/Pause,
  Step, Reset, speed select) with keyboard shortcuts (Space play/pause, N step, C reset),
  view selector (material/temperature/oxygen/CO2/flow/camera) with a colour legend, and
  Build panel (brush radius, fan direction, 25 material swatches) and World panel.
- **PresetsPanel** (`view/PresetsPanel.tsx`): a browser for all 129 NASA BASS-II presets
  with searchable/filterable list (material, outcome, fidelity), a detail card (outcome,
  sample, conditions, fidelity, rule, run steps, NASA readings), lighting selector
  (Opposed vs Concurrent), and Load & Run controls.
- **The engine's grid** is colourised per `view` via `colors.ts` (lookup tables per scale,
  one RGBA pixel per cell). Flow view averages face velocities to cell centres. Camera
  view shows gas as black with solids barely visible and a glow. Presets loaded from the
  WASM module.

### 5.7 Sources page
`/sources` — currently a stub returning "Pending." (untracked, not wired).

---

## 6. The column resolution & row parsing "engine" (`src/lib/combustion.ts`)

The analytical core. All functions are pure, framework-free, and deterministic, so they are
unit-testable without React/Payload/Browser.

- **`resolveColumn` / `resolveColumnSet` / `resolveBass2Columns`** — resolve one logical
  role to a source column through the 4-step pipeline. Tracks ambiguous fuzzy matches.
- **`findDuplicateMappings`** — detects roles that resolve to the same source column (a
  mapping bug).
- **`parseRows`** — builds `ParsedRow[]` from `DataRow[]`. Computes `o2Consumed`,
  `coProduced`, `co2Produced` only from independently-resolved, valid, different columns.
  Classifies each reading (valid/missing/censored/outOfRange/invalid) and carries the
  original raw text in `_rawData` for markers.
- **Reading classification**: numbers → `valid`; empty/"N/A" → `missing`; one-sided bounds
  like `>500`/`<1` → `outOfRange`; censor words (`OR`, `sat`, `over`, `hi`, ...) → `censored`;
  unparseable → `invalid`.
- **`deriveO2Bands`** — equal-width O₂ bins aligned to whole percentages across the observed
  range (half-open `[min,max)`, top edge inclusive), used identically by the heatmap and the
  ranking panel so boundaries never disagree.
- **`computeMaterialMetrics`** — per-material: tests, distinct O₂ conditions, O₂ range,
  bands covered, O₂/CO/CO₂ means, excluded counts (censored/outOfRange/missing).
- **`computeEvidenceScores`** — the scoring formula:
  `Score = w₁·TestCoverage + w₂·O₂Diversity + w₃·O₂Range`, each component normalised
  0–100 against the best material, weights renormalised, missing components excluded first.
  Mean O₂ consumed is deliberately excluded from the score because it depends on sample
  size, burn duration and conditions.
- **Helpers**: `mean`, `stdev`, `thicknessDistribution` (four documented bins),
  `velocityVsO2`, `principalInvestigatorBreakdown`, `gasComposition` (per-gas before/after
  means for separate scales), `summaryStats`, `excludedByMaterial`.

### Why the two "statistics" surfaces agree
`computeShares` in `src/lib/shares.ts` is the single source of truth for row-shares. It is
called once in `page.tsx` and its result is passed to both the **Statistics** card
(Fragments.tsx) and the **Share.tsx** header bar, so the two can never disagree about the
same grouping. `Shares` are limited to a top-N (`limit=3`) with the rest folded into a
hatched "Other" bucket; blank/missing values are labelled "(blank)" and never dropped, so
shares always sum to 100%.

---

## 7. Design system & theme

- **Hard-coded dark palette** in `global.css` (`@theme` + `:root` variables): ink `#120e08`,
  ink-2, ink-3 (cards), line `#2e2418`, fg `#f0ebe2`, muted `#a89e90`, accent
  `--color-flame-amber` `#ffa64d` (the only warm colour), `--color-flame-blue` `#ffa64d`
  (links/focus/info), status scale `#4fa3ff` / `#ffa64d` / `#5fd3a5`, plus an animation
  `flicker`.
- **`ui/chart-theme.tsx`** — the shared `C` object (ink2, panel, panel2, chip, chip2,
  surface, surfaceHover, line, fg, muted, blue, amber, pink, green, violet, red) and
  `CHART_COLORS`, plus `panelCls`/`panelStyle` used by the evidence/visualization panels.
- **Runtime theming** exists but is currently **unwired**: `ui/ThemeContext.tsx` +
  `ui/themes.ts` define `ThemeProvider` / `THEMES` (20 palettes, default "Ember") and a
  `useThemePalette` hook, plus `applyCssVariables` that pushes a palette to the CSS
  variables. No component in the dashboard actually consumes the context (no `ThemeProvider`
  in the dashboard layout, no switcher control found in the tree), so the runtime theme
  switch is present but not reachable from the UI. The default "Ember" palette matches the
  hard-coded dark theme, so the two are consistent.
- **UI primitives** (`ui/Card.tsx`): `Card` (rounded 32px border + ink background), `Icon`
  (SVG path renderer), `Arrow`. Shared borders/badges use the `C`/`C.*` tokens.
- **Typography**: custom Next.js fonts via `next/font` — Bricolage_Grotesque (display) and
  Instrument_Sans (body), referenced as CSS variables `--font-bricolage` / `--font-instrument`
  in `global.css`.

---

## 8. Stale documentation vs. source of truth

The `dashboard/docs/` files (architecture.md, components.md, data-flow.md) are **out of
sync** with the current working tree in several places:

| Docs claim | Actual code |
|---|---|
| Overview tab renders a "Visualization" component | Visualization is a separate tab; OverviewContent does not include it |
| Tab `ranking` | Actual tab id is `evidence` |
| `layout/Header.tsx` client component ("Freefall labs" brand, tab navigation) | That file has been **deleted** from the tree; its role is absorbed by `Sidebar` inside `Workspace` |
| `ui/Share.tsx` described as "Dataset share-link component" and "Used at the top of the dashboard" | `Share.tsx` is a `TopStats` dataset-name/mean-stat card; it is **not imported anywhere** in the current dashboard |
| Docs say `ThemeContext`/`useThemePalette` are used for theme switching | ThemeContext is defined but **never provided** in the dashboard layout and **never consumed** by any component; the switch control does not exist |
| `docs/README.md` lists `overview/SummaryChart` etc. | Correct, but the docs' "components.md" is stale in the tab/component names above |
| Docs describe the general server/component data flow | Correct and matches `page.tsx` / `util.ts` |

---

## 9. Orphan / dead code in the dashboard

- `Fragments.tsx` exports `SummaryAndChart`, but the tab registry imports `SummaryAndChart`
  from `overview/SummaryChart.tsx` instead. `Fragments.SummaryAndChart` is exported but
  unreachable. It is the component that contains the hard-coded "Triage 1234 / Fixing 0 /
  Investigating 24" template stats and the fake incident-frequency chart.
- `ui/Share.tsx` — defined but not imported by the dashboard shell.
- `components/layout/Header.tsx` — deleted from the working tree (it exists in git HEAD and
  is still referenced by the stale docs). The Sidebar inside Workspace now plays its role.
- The root `/sources` page is a stub ("Pending.") — not wired.

Everything else the staging documents describe (workspace, tabs, summary, statistics,
evidence, heatmap, visualization, interpretation, papers, sandbox) exists and is wired.

---

## 10. Test coverage

Unit tests (``test:int``, vitest, jsdom): `tests/int/combustion.logic.spec.ts`
(column resolution/row parsing/evidence scoring), `tests/int/shares.spec.ts` (row shares),
`tests/int/components/layout-reducer.spec.ts` (layout tree reducer — untracked, in the
working tree). The vitest config includes `tests/int/**/*.spec.ts`.

E2E tests (``test:e2e``, Playwright): `tests/e2e/admin.e2e.spec.ts` and
`tests/e2e/frontend.e2e.spec.ts`, with helpers `tests/helpers/login.ts` and
`tests/helpers/seedUser.ts`.

Build/lint: `pnpm build` (cross-env max-old-space-size=8000), `pnpm lint` (eslint),
`pnpm test` = `test:int && test:e2e`. Workspace is a pnpm workspace (`pnpm-workspace.yaml`,
with sharp/esbuild/unrs-resolver built specially).

---

## 11. Environment & deployment notes

- **Database**: `DATABASE_URL` points at a Supabase Postgres pooler (`aws-0-ap-south-1`).
  This is **not** a local Postgres; it is a managed pool and works for the hosted app.
- **Storage**: `@payloadcms/storage-s3` with `clientUploads: true` → files upload straight to
  S3; requires `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (see
  `.env.example`).
- **AI integration**: optional `/api/interpretation` route (the Overview assistant and the
  Interpretation tab), gated on `OPEN_ROUTER`. When absent, the deterministic fallback is
  used. The old open `/api/openrouter` route was removed (fix/security). Limits, in
  `src/lib/ai-guard.ts`: the model is fixed on the server (`openai/gpt-4o-mini`); a
  question is at most 500 characters; each visitor (by IP address) gets at most 10 new
  requests every 10 minutes; each interpretation and answer is cached in memory, keyed by
  what the model is sent, so repeats are free and don't count (the cache is lost when the
  server restarts).
- **Toolchain note** (from the project's own history): the repo pins pnpm and the local
  global pnpm can corrupt the pnpm 12 lockfile (`ERR_PNPM_BROKEN_LOCKFILE`); the README /
  `.npmrc` style tooling expects pnpm 12.x under Node >= 20.18.1. The `next.config.ts`
  adds a Webpack `extensionAlias` so ESM/CJS interop works, and `next.config` + Payload
  wrapper (`withPayload`) is configured.
- No sensitive files were read in this analysis: `.env` values are masked in the file
  itself, and nothing was printed or logged anywhere.

---

## 12. Open items & risks

1. **Template filler** — Overview still renders hard-coded `ActiveIncidents`, `Vulnerability`
   and `Assistant` panels with no dataset relationship; they are leftovers, not data-driven.
2. **Unwired theme switching** — the palette system (`ThemeContext`, `themes.ts`,
   `useThemePalette`) exists but is not reachable from the UI; the theme switcher control
   is missing.
3. **Stale docs** — `dashboard/docs/*.md` describe an earlier tab/layout (ranking tab,
   `Header` component, `Share` at top of dashboard). They should be updated to match the
   current tree before they are used as a reference.
4. **Orphan code** — `Fragments.SummaryAndChart`, `Share.tsx`, and the deleted
   `Header.tsx` are either unreachable or already removed from the tree.
5. **GenericCompare is always enabled** — it renders for every dataset, including ones
   without combustion columns; the graceful-degradation panel only disables the
   BASS-II-specific charts, not the generic comparison.
6. **No live data in this analysis** — I analysed the source code and repository state only.
   I did not run the app, query the database, or execute the test suite, so I cannot confirm
   live row counts, dataset contents, or that the unit/E2E suites currently pass. Any
   numbers shown by the dashboard depend on the actual CMS data.

---

*Prepared from a read-only analysis of the repository tree. End of summary.*
