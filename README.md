# Flame in Freefall — NASA microgravity combustion dashboard

A read-only, data-driven web app for exploring NASA combustion experiments
collected aboard the International Space Station (BASS-II and 13 other PSI
investigations), ranked for crew-habitat fire safety, plus a sandboxed
combustion simulator and a Payload admin panel for managing datasets.

- **Framework:** Next.js 16 (App Router, React Server Components) + React 19
- **CMS:** Payload 3.0 (Postgres backend)
- **Styling:** Tailwind CSS 4 · **Charts:** Recharts 3 · **Background:** Three.js
- **Language:** TypeScript 5
- **Branding:** the public product is called **Flame in Freefall**; the
  dashboard is served at `/dashboard?dataset=<id>`

The app is a **PWA-style workspace**: the public site is two pages (`/` and
`/dashboard`), with an admin panel, an API surface, and a set of supporting
scripts and data files.

---

## Page directory

```
src/app/(frontend)/          Public dashboard (React Server Components)
├── page.tsx                 Home — "Flame in Freefall"
├── dashboard/               The data app (server entry + tabbed workspace)
├── sources/page.tsx         Sources documentation
├── login/page.tsx           Admin login form
└── (payload)/               Payload admin panel
    admin/[[...segments]]/   Admin app shell
    api/                     Payload REST + GraphQL endpoints
src/app/(payload)/           Payload admin app (admin layout, importMap)
src/collections/             Payload CMS collections (Datasets, Rows, Papers, Users, Chats)
src/lib/                     Pure data logic (combustion scoring, PSI, persona)
src/scripts/                 Data import/catalogue generation scripts
src/app/(frontend)/dashboard/components/  Per-tab React components
src/app/(frontend)/dashboard/docs/       Dashboard project documentation
```

---

## Public pages

### Home — `/`

**`src/app/(frontend)/page.tsx`**

The landing page, titled **"Flame in Freefall"**. It is an intro/marketing
screen with no datasets in it:

- Header with the "Flame in Freefall" wordmark and links to Dashboard, Sources
  and Sandbox.
- Hero: "Fire behaves differently in space. Compare how." with a short
  description and two CTA buttons (Open the dashboard / Browse sources).
- A pixel-art **sandbox temperature view** (BASS-II test B14 at a given step,
  rendered by the sandbox engine itself) with a "Run it in the sandbox" link.
- **"Ranked for habitat fire safety"** — the 14 PSI investigations scored at
  equal weights, with the top 5 shown; link to the Investigations tab.
- **"What you can do here"** — five feature cards: Catalogue (PSI investigations
  as cards), Rank (transparent scoring with adjustable weights), BASS-II (charts
  and data table for the 129 tests), Simulate (run tests in the sandbox and see
  whether they match NASA's outcome), Ask (AI explanations grounded in the data),
  Moon base (extrapolation card at 34% O2, 0.17 g).
- **"Built from NASA's open records"** — the three data sources (PSI, NTRS, and
  the stated assumptions), with a "See all sources" link.
- **"Bring your own dataset"** — an explainer for admins: add a dataset and its
  papers in the admin panel, define columns, upload the CSV (validate first),
  then it opens at `/dashboard?dataset=…`.
- Footer: "Built for the NASA Space Apps Challenge 2026" + "Independent project
  using open NASA data. Not affiliated with NASA."

Metadata: title **Flame in Freefall**, description explaining the ranking and the
BASS-II sandbox.

### Dashboard — `/dashboard`

**`src/app/(frontend)/dashboard/page.tsx`**

The main data app. Server entry point. It:

1. Reads `?dataset=` and `?tab=` from the URL.
2. Loads the dataset definition and all rows through `src/components/util.ts`
   (each call enforces the published-only access rule).
3. Resolves the combustion column mapping (`resolveBass2Columns`), parses every
   row (`parseRows`), computes row-shares (`computeShares`), and renders the
   **Workspace** (the tabbed main area).
4. Maps bad/missing `?dataset=` to a friendly "Dataset not found" page, and a
   database that can't be reached to a friendly "data unavailable" page instead
   of a raw 500.

The workspace is a **JupyterLab-style pane tree** (`layout-reducer.ts`): a
sidebar lists the tabs, clicking one opens it in the focused pane, and a split
button opens a new pane on the right. The tree is a pure, unit-tested reducer
with leaf nodes (pane + tab strip) and split nodes.

The active tab is chosen from this registry:

| Tab id | Label | What it renders |
|---|---|---|
| `overview` | **Overview** (default) | Title, summary chart + named links, key numbers, Materials card, Scorecard card, AI assistant, Sources strip, Limitations, "About this dataset" card (column list + row preview, plus a live Statistics breakdown of rows by Principal Investigator). |
| `investigations` | **Investigations** | NASA PSI catalogue: 14 investigation cards, ranked by transparent criteria with adjustable weights, plus widgets for ranking, weights, AI summary, simulation status, filter/sort, the Moon-base extrapolation card, and stated assumptions. |
| `evidence` | **Evidence** | EvidenceRanking (evidence-coverage scores, adjustable weights, sort), OxygenHeatmap (materials × O₂ band heatmap, adjustable band width), Limitations. |
| `visualization` | **Visualization** | Charts grouped by material: outcome chart, tests/mean O₂·CO·CO₂ by material, before/after gas composition, thickness distribution, air velocity vs O₂ consumed, tests by Principal Investigator, plus the raw data table with censored markers, and the dataset-agnostic GenericCompare scatter. |
| `ai-summary` | **Interpretation** | The AI chat panel (`ChatUI`) — attribute the dataset's rows, answer questions with the deterministic fallback or OpenRouter, label AI output as interpretation. |
| `papers` | **Referenced Papers** | List of papers linked to the dataset. |
| `sandbox` | **Sandbox** | The combustion simulator (see below). |
| `conclusions` | **Conclusions** | Findings, evidence gaps, data bias, recommendations, and "beyond space" for the BASS-II dataset. |
| `customize` | **Customize** | Theme picker (20 palettes) + a live preview sample + the data colour scale (see below). |

Notes:

- `?tab=` in the URL switches to that tab; `?dataset=` selects the dataset.
  Sandbox links carry `?tab=sandbox&preset=B14`, `?tab=sandbox&group=bass`,
  `?tab=sandbox&demo=cfig`, `?tab=sandbox&scenario=moon`.
- Tabs can be split into panes, docked, and their layout is remembered in
  `localStorage` (`psi-layout-v1`); weights are remembered (`psi-weights-v1`).

### Sources — `/sources`

**`src/app/(frontend)/sources/page.tsx`**

Documentation of where every number comes from. It renders:

- **Papers** — the hand-checked NTRS papers (title + NTRS id + investigation),
  listed only where checked.
- **NASA PSI tables (14)** — a table of every investigation: PSI id, what was
  burned, rows (with granularity), and the cleaned file name.
- **Stated assumptions** — ISS cabin air, the exploration atmosphere
  (Norcross et al. 2013), and cabin ventilation (SAE 932191); these are NOT
  NASA data and are shown so the ranking can be reviewed.

The page explains the two rules in plain language: values are cleaned without
inventing, and papers are listed only where they've been checked.

### Login — `/login`

**`src/app/(frontend)/login/page.tsx`**

A client-side sign-in / sign-up form. Two modes, toggled by a link:

- **Log in** — POSTs email + password to `/api/users/login`.
- **Sign up** — validates the password (min 8 chars, matching confirmation),
  POSTs to `/api/users` to create the account, then logs in.

On success it redirects to `/` (the page will then offer the admin route).
Errors are shown inline. Note: this is only the **frontend form**; authentication
is enforced server-side by the Payload collections (`/api/users`, `/api/users/login`).

### Sandbox — `/sandbox` (sandbox tab inside the dashboard)

**`src/app/(frontend)/dashboard/components/sandbox/`**

A self-contained mini-app (inside the dashboard layout) for the
`flame_core` WebAssembly engine. It is **not** tied to a dataset — it has its
own presets and its own model fuels.

- **Engine** (`engine/Engine.ts`) — a thin TypeScript wrapper around the
  `flame_core` C API exported from `engine/flame_core.mjs` (a `.wasm` module).
  Exposes `reset`, `step`, `setParam`/`getParam`, `paint`/`paintFan`/`erase`/
  `ignite`/`addHeat`, `summary`, `events`, `outcome`, `log`, `camera`,
  `presetCount/preset/presetStatus`. The material table is AIR, WOOD, FAN, PMMA,
  SIBAL, NOMEX, WAX… with RGB + kind. Every C function is prefixed `_fc_` and
  strings are read as pointers.
- **GridCanvas** (`view/GridCanvas.tsx`) — two `<canvas>`s: a pixel grid
  (one cell per pixel, `image-rendering: pixelated`) and an overlay for arrows
  and the brush. `GridView` drives `fillView` (pure colourisation) every frame.
- **Controls** (`view/Controls.tsx`) — tabs Build / World / Presets; a run bar
  (Play/Pause, Step, Reset, speed 1–8) with keyboard shortcuts (Space play/
  pause, N step, C reset); a view selector (material / temperature / oxygen /
  flow / CO2 / CO / camera) with a colour legend; a Build panel (brush radius,
  fan direction, 25 material swatches) and a World panel.
- **PresetsPanel** (`view/PresetsPanel.tsx`) — a browser for all 129 NASA
  BASS-II presets with a searchable/filterable list (material, outcome,
  fidelity), a detail card (outcome, sample, conditions, fidelity, rule,
  run steps, NASA readings), a lighting selector (Opposed vs Concurrent) and
  Load & Run controls.

Views: Material (fuel layout), Temperature (the burning sample), Oxygen
(O₂-limited burning), Flow (ventilation), CO2, CO, Camera (gas black,
solids faint, with glow). The Moon-base what-if (`?tab=sandbox&scenario=moon`)
runs BASS-II test B1 with only oxygen raised to 34% and gravity set to 0.17 g
— marked as an extrapolation because the engine is not validated above 22.2%
O₂ and doesn't model pressure (runs at 1 atm).

Two side panels: a **PresetsPanel** (list of presets with the sandbox results
recorded) and a **Controls** panel. The page receives `dataset`/`rows` from the
dashboard so presets can be cross-referenced with NASA's readings.

---

## Admin panel — `/admin`

**`src/app/(payload)/admin/[[...segments]]/page.tsx`**

The Payload admin app (generated, don't edit). It provides:

- Authentication (`/api/users` signup/login, sessions).
- **Collection management** for all CMS collections (`users`, `media`,
  `papers`, `datasets`, `dataset-rows`, `dataset-imports`, `chat-threads`,
  `chat-messages`).
- **CSV import** — upload a CSV, validate it, and create `Dataset` +
  `DatasetRows` documents.
- **S3 media uploads** (client-side to S3).

The admin panel is reachable by anyone; the README and deploy notes strongly
recommend strong passwords and keeping `PAYLOAD_SECRET` out of git.

---

## Public API routes — `/api/*`

All routes enforce authentication via `src/lib/chat-auth.ts` (require an
authenticated owner). The API is split into three areas:

### Chat (the `ai-summary` tab)

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Streaming chat using the AI SDK. Provides tools: `listInvestigations` (14 PSI cards with score/rank), `getInvestigation` (full card record), `openSandbox` (offer a sandbox view for a BASS-II test). The model is fixed server-side and only ever receives the checked-in PSI catalogue, never raw data. |
| `/api/threads` | GET, POST | List the owner's chat threads or create a new one. |
| `/api/threads/[id]` | GET, PATCH, DELETE | Read/update/archive or delete a thread. |
| `/api/threads/[id]/messages` | GET, POST | List or post messages in a thread. |

### Dataset interpretation (the `/dashboard` AI panel)

| Route | Method | Purpose |
|---|---|---|
| `/api/interpretations` | GET | Plain-language summary of a dataset: parses the CSV, computes material metrics, returns a deterministic fallback plus optional AI output, and lists all materials. |
| `/api/psi-interpretation` | GET | One-line summary of a single PSI investigation (or `?id=overall` for the ranking), generated from the checked-in `psi.json` facts with the number/invented-figure guard. |
| `/api/cf-interpretation` | GET | Same as above but for the sandbox CF (combustion) dataset. |

### Sandbox

| Route | Method | Purpose |
|---|---|---|
| `/api/sandbox` | GET | Returns the sandbox's preset list and results for the UI. |
| `/api/preset-status` | GET | Returns the current running state of a preset. |

**AI cost controls** (in `src/lib/ai-guard.ts`): a fixed model, a per-visitor
limit (e.g. 10 new requests per 10 minutes), a daily cap on paid calls, an
in-memory cache keyed by exactly what the model is sent, and the model is
forbidden from inventing numbers that are not in the data it is given.

---

## Supporting infrastructure

### Data model — Payload collections

Defined in `src/collections/`:

- **Users** — auth-enabled admin accounts.
- **Media** — S3 uploads (alt text only).
- **Papers** — title, authors, year, document type, NTRS id (unique, indexed),
  DOI, source URL, license, experiments, linked datasets, abstract, full text
  (hidden from public).
- **Datasets** — name, description, `columns[]` (label/key/type/unit/
  `canonicalField`/options/required/csvHeader), row count, last imported time,
  `papers[]` links.
- **DatasetRows** — one flat row per CSV row: `data` JSON keyed by column key,
  `rowIndex`, `sourcePaper`, `sourcePage`, `rawData` (the original text of any
  non-numeric reading, kept so censored readings aren't silently treated as
  blanks).
- **DatasetImports** — uploaded CSVs, validated against a dataset's columns.
- **ChatThreads / ChatMessages** — owner-scoped chat history for the AI panel.

### Pure logic — `src/lib/`

All framework-free, deterministic, unit-tested:

- **combustion.ts** — column resolution (admin canonical mapping → exact key →
  exact label → unique fuzzy substring), row parsing (valid/missing/censored/
  out-of-range/invalid), material metrics, evidence scoring, O₂ band derivation.
- **psi.ts** — the 14-investigation catalogue types, the five ranking
  criteria, the habitat reference values, `rank`, `rankLabel`, `testsLabel`.
- **psi-ai.ts / psi.ts** — the AI prompts, the facts sent to the model, and the
  answer guards (rejects invented numbers, too-general answers, unmarked
  interpretations).
- **ai-guard.ts** — the model, rate limits, daily cap, in-memory cache, and
  visitor identification.
- **shares.ts** — row-share computation (used identically by the Statistics card
  and the header bar so they can never disagree).
- **widget-layout.ts** — the pure widget-layout reducer and parser for the
  Investigations tab.
- **columns.ts / columns.ts** — column-type helpers.
- **ai-call.ts** — OpenRouter call wrapper.
- **errors.ts** — `isNotFoundOrForbidden` helper.

### Generation scripts — `src/scripts/`

- **import-csv.ts** — the CSV importer (parses, infers column types, validates
  rows, stores rawData for non-numeric readings).
- **psi-catalogue.ts** — generates `src/app/(frontend)/dashboard/components/investigations/psi.json`
  (the 14-investigation catalogue, ranking, and facts) from cleaned NASA tables
  + sources.json + the sandbox scorecard. Regenerated when the cleaned data
  changes; `psi.json` must never be edited by hand.
- **psi-tables.ts / psi-catalogue.ts** — PSI table helpers.
- **import-bass2-clean.ts** — imports the cleaned BASS-II dataset (id 4).
- **export-datasets.ts** — database backup writer.
- **switch-bass2-default.ts** — changes which BASS-II dataset is default.
- **seed-papers.ts / download-papers.py / home-flame.ts / sandbox-scorecard.ts**
  — miscellaneous data setup.
- **dataset.ts** — dataset schema definitions.

### Data — `data/`

- **psi/** — cleaned NASA PSI tables, the investigations catalogue CSV, and
  sources.json.
- **bass2_all_outcomes.csv** — raw BASS-II outcomes.
- **PSI-25_BASS-II_cleaned.csv** — raw cleaned BASS-II table.
- **README-bass2-clean.md / README-bass2-scorecard.md** — dataset READMEs.

---

## Dashboard project documentation — `/dashboard/docs/*`

Built into the repo for the dashboard development team:

- **README.md** — project overview, architecture, data flow, component
  reference, environment variables, and a table of the tabs.
- **architecture.md** — system architecture, data flow, API routes, caching
  strategy, and security.
- **components.md** — component-by-component reference for the dashboard.
- **data-flow.md** — the complete path from CSV import to chart.
- **investigations.md** — deep-dive into the Investigations tab: the 14 cards,
  the ranking criteria and formula, weights, the Moon-base extrapolation, the
  AI interpretation, the simulation statuses, and the file list.

> Note: the `dashboard/docs/` files are kept somewhat out of sync with the
> current tree (they describe an older tab layout — a "ranking" tab, a
> deleted `Header` component, a top-of-dashboard `Share` component). The live
> tabs are the nine listed above.

---

## What each page does, at a glance

| Page | Purpose | Read-only for visitors? |
|---|---|---|
| `/` | Home / marketing / ranking preview / sandbox image | Yes |
| `/dashboard` | The data app: dataset loading, tabbed workspace, charts, evidence, simulations, AI chat, conclusions | Yes (for published datasets) |
| `/sources` | Documentation of NASA PSI tables, papers, and stated assumptions | Yes |
| `/login` | Sign-in / sign-up form | No |
| `/admin` | Payload admin panel (collection CRUD, CSV import) | No |
| `/api/*` | Chat, threads, dataset interpretation, sandbox data | No (auth required, scoped) |
| `/dashboard/docs/*` | Dashboard project documentation | Yes |

---

## Development

```bash
pnpm install
pnpm dev          # dev server at http://localhost:3000
pnpm build        # production build
pnpm start        # production server
pnpm test         # unit (vitest) + e2e (Playwright)
pnpm lint         # ESLint
```

Environment variables (from `.env.example`):

| Variable | Needed? | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (shared Supabase) |
| `PAYLOAD_SECRET` | Yes | Signs admin sessions |
| `OPEN_ROUTER` | Optional | OpenRouter AI key; without it AI panels use the built-in summaries |
| `S3_BUCKET`… | Only for media uploads | S3-compatible storage for the `media` collection |
| `PAYLOAD_PUSH` | Leave unset | Schema push (off in dev/tests/prod) |
| `DATASET_PREVIEW_IDS` | Leave unset | Local preview of unpublished datasets (dev only) |

### Conventions for the team

- One commit per feature, conventional-commit style with the issue ref as a
  suffix; one branch per issue named from the issue id.
- PRs are opened for the partner to review and close, not self-merged.
- No AI attribution anywhere in deliverables (no "Generated with" footers,
  no AI mentions in commit messages, code, or diffs).
