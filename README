# Flame in Freefall

**An evidence dashboard for fire safety in microgravity and on the Moon.**

Built for the NASA Space Apps Challenge 2026. It turns NASA's microgravity combustion records from the International Space Station into something you can search, compare, rank and question, and it shows where the evidence stops.

> Live demo: https://freefall-flame-72z4.vercel.app/

## Why it exists

Fire behaves differently in free fall. With no buoyancy, a flame becomes a blue sphere fed by slow diffusion, and smoke does not rise to a ceiling detector. Planned Moon-base air (30% oxygen or more at 10.2 psi or less) is also far more flammable than Earth air. NASA has decades of results in its Physical Science Informatics (PSI) database, but they are hard to find, compare and interpret.

Flame in Freefall loads BASS-II and 13 other PSI investigations, ranks them for crew-habitat fire safety with transparent, adjustable criteria, and marks every gap as a gap.

**Headline finding:** in the tables loaded here, no solid-material test goes above 22.2% O₂ (BASS-II; Saffire's highest is 22.1%), and PSI holds no partial-gravity data yet. Moon-base conditions sit beyond the evidence, so the data bounds the risk and does not predict it.

## What you can do

| Area | What it gives you |
|---|---|
| **Home** (`/`) | Intro, a sandbox render of BASS-II test B14, and a preview of the top-ranked investigations |
| **Investigations** | The 14 PSI investigations as cards, ranked on five criteria with adjustable weights, a Moon-base extrapolation card, and the stated assumptions |
| **Overview** | Dataset summary, key numbers, materials, scorecard, sources, limitations, a column list with row preview, and a breakdown of rows by Principal Investigator |
| **Evidence** | Materials ranked by evidence coverage (not danger), plus a materials × O₂ heatmap where empty cells are gaps, not proof of safety |
| **Visualization** | Gas composition before and after tests, thickness distribution, air velocity against O₂ consumed, tests per material, a raw table that shows censored readings as recorded, and a plot-any-two-columns comparison |
| **Interpretation** | An AI chat panel grounded in the checked-in PSI catalogue, with a deterministic fallback when no AI key is set |
| **Referenced Papers** | The NTRS papers linked to the dataset |
| **Sandbox** | A playable flame simulator with all 129 NASA BASS-II presets |
| **Conclusions** | Findings, evidence gaps, data bias and recommendations |
| **Customize** | A theme picker (20 palettes) with a live preview |
| **Sources** (`/sources`) | Every PSI table, the hand-checked papers, and the assumptions that are not NASA data |

The dashboard is a resizable, JupyterLab-style workspace. Click a tab to open it in the focused pane, or split it to the right to put a chart next to the papers behind it. Layout and weights are remembered in `localStorage`.

### Sandbox

The sandbox runs on `flame_core`, a C engine compiled to WebAssembly.

- **Build:** paint a grid with 25 materials (wood, PMMA, SIBAL, Nomex, wax, fans and more), place fans in any direction, erase, ignite and add heat.
- **Run:** play, pause, step and reset (`Space`, `N`, `C`) at speeds 1 to 8.
- **Views:** material, temperature, oxygen, flow, CO₂, CO and a camera view.
- **Presets:** search and filter all 129 BASS-II tests by material, outcome and fidelity, choose opposed or concurrent spread, and compare the simulated outcome with NASA's.
- **Moon-base what-if:** BASS-II test B1 with only oxygen raised to 34% and gravity set to 0.17 g, marked as extrapolation.

## How it stays honest

- **Evidence is not danger.** Rankings measure how much data exists, never how hazardous a material is.
- **Nothing is invented.** Missing values stay missing. Censored or out-of-range readings (`>500`, `OR`, `sat`) are stored as `null` with the original text kept in `rawData`, and shown as source text, never as zero.
- **Gaps are shown as gaps.** An empty heatmap cell means untested.
- **Deterministic first.** Every figure comes from pure, unit-tested code. AI explains and never computes.
- **AI is guarded.** The model is fixed on the server and only sees the checked-in catalogue, never raw data. Answers that invent numbers, are too general or are not marked as interpretation are rejected.
- **Assumptions are labelled.** The ISS cabin air, the exploration atmosphere (Norcross et al., 2013) and cabin ventilation (SAE 932191) are not NASA data and are listed on `/sources` so the ranking can be reviewed.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build
pnpm start        # production server
pnpm test         # unit (Vitest) + end-to-end (Playwright)
pnpm lint
```

Requires Node 20.18.1 or newer and pnpm 12.x.

Copy `.env.example` to `.env`:

| Variable | Needed | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `PAYLOAD_SECRET` | Yes | Signs admin sessions; never commit it |
| `OPEN_ROUTER` | Optional | OpenRouter key. Without it, AI panels use the built-in summaries |
| `OPEN_API_ROUTER` | Optional | OpenRouter LLM key. |
| `PAYLOAD_PUSH` | Leave unset | Schema push is off by default; set `true` for one dev run to apply an approved schema change |
| `DATASET_PREVIEW_IDS` | Leave unset | Preview unpublished datasets locally (dev only) |

## Bring your own dataset

1. Open `/admin` and sign in.
2. Add a **Dataset** and its **Papers**, then define the columns (label, key, type, unit, canonical field).
3. Upload the CSV under **Dataset Imports** and use _validate first_.
4. Open `/dashboard?dataset=<id>`. Datasets are visible to visitors only when published.

The importer infers column types, validates every row and records censored readings. Charts that need combustion columns degrade to a clear message naming the missing ones, and the generic comparison works on any numeric data.

## How it works

```
CSV ─▶ import-csv.ts ─▶ Payload (Postgres) ─▶ server components ─▶ pure logic ─▶ client charts
        infer + validate     datasets, rows        getDataset/getAllRows   combustion.ts    Recharts
```

- **Column resolution:** admin canonical mapping, then exact key, then exact label, then a unique fuzzy match. Ambiguous matches are flagged, never guessed.
- **Row parsing:** each reading is `valid`, `missing`, `censored`, `outOfRange` or `invalid`. O₂ consumed is computed only from two valid, independent columns.
- **Evidence score:** test coverage, O₂ diversity and O₂ range, each normalised against the best-covered material, with adjustable weights. A missing component is excluded and the rest renormalised.
- **Investigations ranking:** five criteria over the 14-investigation catalogue (`psi.json`, generated by `src/scripts/psi-catalogue.ts` and never edited by hand).

### Stack

Next.js 16 (App Router, React Server Components), React 19, TypeScript 5, Payload 3.0 on Postgres, S3-compatible storage, Tailwind CSS 4, Recharts 3, Three.js (background), PapaParse, AI SDK with OpenRouter, a WebAssembly C engine for the sandbox, Vitest and Playwright.

### Layout

```
src/app/(frontend)/       Public site: /, /dashboard, /sources, /login
  dashboard/components/   One folder per tab
  dashboard/docs/         Developer documentation
src/app/(payload)/        Admin panel and REST/GraphQL API
src/collections/          Users, Media, Papers, Datasets, DatasetRows,
                          DatasetImports, ChatThreads, ChatMessages
src/lib/                  Pure, unit-tested logic (combustion, psi, shares, ai-guard)
src/scripts/              Importers and catalogue generation
data/psi/                 Cleaned PSI tables, catalogue CSV, sources.json
data/                     BASS-II CSVs and dataset READMEs
```

## API

All routes require an authenticated owner (`src/lib/chat-auth.ts`).

| Route | Methods | Purpose |
|---|---|---|
| `/api/chat` | POST | Streaming chat with tools `listInvestigations`, `getInvestigation`, `openSandbox` |
| `/api/threads`, `/api/threads/[id]`, `/api/threads/[id]/messages` | GET, POST, PATCH, DELETE | Owner-scoped chat history |
| `/api/interpretations` | GET | Dataset summary: deterministic fallback plus optional AI |
| `/api/psi-interpretation` | GET | One-line summary of one investigation, or `?id=overall` |
| `/api/cf-interpretation` | GET | The same for the sandbox CF dataset |
| `/api/sandbox`, `/api/preset-status` | GET | Preset list, results and running state |

**AI cost controls** (`src/lib/ai-guard.ts`): fixed model, a per-visitor limit (10 new requests per 10 minutes), a daily cap on paid calls, and an in-memory cache keyed by exactly what the model is sent. The cache and the daily count reset when the server restarts.

## Limitations

- Microgravity is not lunar or Martian gravity, and PSI has no partial-gravity data yet.
- Gas measurements are not fire outcomes.
- The sandbox is not validated above about 22% O₂ and runs at 1 atm, so pressure is not modelled.
- Excluded censored readings can bias statistics low.
- Evidence scores describe coverage, not risk.
- `/admin` and `/login` are reachable by anyone. Use strong passwords and keep `PAYLOAD_SECRET` out of git.

## Contributing

- One branch per issue, named from the issue id.
- One commit per feature, in conventional-commit style with the issue reference as a suffix.
- Open a pull request for review and do not self-merge.
- Keep commits, code and diffs free of generated-by footers or tool attributions.
- Never edit `psi.json` by hand. Regenerate it with `src/scripts/psi-catalogue.ts`.
- The files in `dashboard/docs/` lag the current tab layout, so treat the source as the truth.

## Credits

Built for the NASA Space Apps Challenge 2026. This is an independent project using open NASA data (PSI and NTRS) and is not affiliated with NASA.