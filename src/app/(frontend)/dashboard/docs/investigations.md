# The Investigations tab

One tab of the dashboard (`/dashboard?tab=investigations`). It answers a single
question: **of NASA's microgravity combustion investigations, which ones speak
most directly to fire safety in a crew habitat — and what does each one
actually say?**

It is a static, read-only surface. There is no database query, no network call
and no writing: everything on it comes from one checked-in JSON file,
`src/app/(frontend)/dashboard/components/investigations/psi.json`, which is
built by a script from cleaned NASA tables. That makes the tab cheap to render
and easy to reason about — and it means the tab's numbers can never drift from
the data it cites.

---

## 1. Where it sits

- Tab id `investigations`, label "Investigations", registered in
  `src/app/(frontend)/dashboard/components/workspace/tabs.tsx`
  (`TAB_REGISTRY.investigations` → `<Investigations links={d.links} />`).
- Sidebar order: `TAB_ORDER` in the same file (second, after Overview).
- The component itself: `src/app/(frontend)/dashboard/components/investigations/Investigations.tsx`.
- URL: `/dashboard?tab=investigations`. Deep links into it:
  `?tab=investigations&card=flex` opens the FLEX card's details (see §7).

The tab receives only `links` from the workspace — the data comes from the
module-level `psi.json` import, not from props.

---

## 2. The data: psi.json, built by a script

`psi.json` (≈1,500 lines, 44 KB) is the whole content of the tab. It holds:

- `about` — provenance note ("do not edit by hand").
- `catalogueSha256` — hash of the source catalogue CSV, so a checkout can be
  checked against its input.
- `reference` — the three stated assumptions the ranking compares against
  (ISS cabin air, the exploration atmosphere, cabin ventilation).
- `investigations[]` — the 14 cards (see §3).
- `moonBase` — the Moon-base extrapolation card's numbers (see §6).

It is produced by `src/scripts/psi-catalogue.ts`:

```
node --import tsx/esm src/scripts/psi-catalogue.ts          # write psi.json
node --import tsx/esm src/scripts/psi-catalogue.ts --check  # rebuild, compare, write nothing
```

Inputs, all local:

| Input | Role |
| --- | --- |
| `data/psi/investigations_catalogue.csv` | one row per investigation: fuels, O₂, pressure, flow, test count, granularity, outcome recording, safety theme, cleaned file name |
| `data/psi/<cleaned_file>` | the cleaned NASA PSI tables the facts are computed from |
| `data/psi/sources.json` | hand-checked paper references (title, NTRS id, url) |
| `src/app/(frontend)/dashboard/components/sandbox/scorecard.json` | the sandbox's own result, quoted in BASS-II's card |

Nothing is fetched. The script also fails loudly if the catalogue's test count
disagrees with the cleaned table's row count, if two investigations slug to the
same id, or if `sources.json` names an investigation the catalogue doesn't have.

`tests/int/psi-catalogue.spec.tsx` pins the file to the script: it rebuilds the
catalogue in memory and asserts `file` equals `build()`. Change the script or
the cleaned data, then rerun the script — the test tells you when you forgot.

---

## 3. The 14 cards

Each element of `investigations[]` is one NASA PSI investigation:

`id` (url-safe slug, e.g. `bass-ii`), `name`, `psiId` (e.g. `PSI-25`),
`fuelPhase`, `hardware`, `tests`, `granularity`, `rows`, `flaggedRows`,
`fuels`, `o2Pct`, `pressure`, `flowCmS`, `outcomeRecorded`, `safetyTheme`,
`simulation`, `cleanedFile`, `facts[]`, `sources[]`, `scores{}`.

Two label helpers in `src/lib/psi.ts` decide what a card shows where:

- `testsLabel(inv)` — tables that are one row per test read `129 (per test)`;
  tables of test days read `18 test days (no single tests)`; FLEX-2's eight
  summary rows read `8 fuels (summary ranges)`. The tab never shows a bare
  number that could be read as "tests" when the table holds something else.
- `rankLabel(r, ranked)` — a rank of its own reads `1.`; a tie reads `2=`.

`facts[]` is computed per investigation by declared specs in `psi-catalogue.ts`
(count / range / sum / note), e.g. BASS-II's `NASA's stated outcome` count
(103 not stated, 17 extinguished low flow, 7 blowoff high flow, …). Text
columns that are not numbers (Saffire's spread rates) are counted as written,
not coerced.

`sources[]` always starts with the PSI table itself
(`{ kind: 'psi', psiId, table }`), followed by any hand-checked papers from
`sources.json`. A card with no checked papers cites only its table.

### Card → details

- `CompactCard.tsx` — the card in the grid: name, PSI id, fuel phase, score,
  rank, simulation-status badge, and three key facts (what was burned, oxygen,
  tests). A **Details** button opens the full card.
- `InvestigationCard.tsx` — the full card: conditions (O₂, pressure, flow),
  tests, outcomes, fire-safety theme, the "What we simulated" status and
  reason, the facts from the cleaned table, the flagged-rows count, and the
  sources with NTRS links. It is rendered inside `CardDrawer.tsx`, a right-hand
  dialog (480 px, full-screen on a phone) with Esc / backdrop / close button,
  a focus trap, and focus returned to the button that opened it.

---

## 4. The ranking

Five criteria, each scored 0–2 with a written reason. The rules and their help
text live in `CRITERIA` (`src/lib/psi.ts`); the per-investigation reasons are
computed in `psi-catalogue.ts` (the first four) or written down as a judgement
(the fifth, flagged "our judgement" on screen).

| Criterion | 2 | 1 | 0 |
| --- | --- | --- | --- |
| Habitat materials | spacecraft solids (PMMA, SIBAL, Nomex, silicone, Kapton, Teflon, Ultem, Pyrell, lampwick) | gas flames emulating solids | model fuels only |
| Habitat atmosphere | covers ISS air **and** reaches the exploration atmosphere | one of the two | neither |
| Cabin airflow | overlaps 7.6–20 cm/s | still/slow air only, or below the minimum | burner flow only, or not given |
| Data richness | ≥100 tests **and** outcomes recorded | one of the two | neither |
| Informs a fire-safety decision | direct (prevention, detection, suppression) | indirect | fundamental science |

Score formula (shown on screen, in `WeightsPanel`):

```
score = Σ (weight × criterion) / (2 × Σ weights) × 100
```

`rank()` in `src/lib/psi.ts` sorts by score then name and assigns a competition
rank: `1 + (how many score strictly higher)`, so ties share a rank (1, 2, 2, 4).
If every weight is 0 it returns null and the ranking widget says so.

Reference values (`HABITAT_REFERENCE`, also in `src/lib/psi.ts`) are stated
assumptions, not NASA data, and the tab says so:

- ISS cabin: about 21% O₂ at 1 atm. Covered when O₂ overlaps 20.5–22.5% and
  pressure overlaps 0.95–1.05 atm.
- Exploration atmosphere: 32–34% O₂ at 8.0–8.2 psia (Norcross et al. 2013,
  NTRS 20130013505). Reached at ≥30% O₂ or ≤0.7 atm.
- Cabin ventilation: about 7.6–20 cm/s (SAE 932191).

At equal weights the order is BASS-II (90), then Saffire I-III and SAME-R tied
at 80, then FLEX and SAME tied, then CFI-G (ACME), with CLD Flame (ACME) last
at 0. The tab's standing caveat: **a score is relevance to habitat fire
safety, not fire risk.** A high score means the data speaks more directly to
habitat conditions, not that a material is dangerous.

### Weights

`WeightsPanel` (in `Ranking.tsx`) gives each criterion a slider, 0–3. Changing
them re-ranks immediately (`rank()` is called in a `useMemo`), and the choice
is saved in the browser under `psi-weights-v1`. A "Reset weights" button
restores equal weights. The AI summary is always for equal weights; if the
viewer has changed them, a line under it names the top three under their
weights.

---

## 5. The widgets

The tab is a set of collapsible panels (`Widget.tsx`), laid out by a pure
reducer in `src/lib/widget-layout.ts` (`widgetLayoutReducer`, `layoutRows`). The
default order is:

1. **Ranking** (`RankingList`) — the ranked list with score bars; clicking a
   name opens that card's details. Half-width, paired with Weights.
2. **Weights** (`WeightsPanel`) — the formula, the sliders, the criterion help.
3. **AI interpretation** (`AiSummary`) — see §8.
4. **What we simulated** (`Simulated.tsx`) — a row per investigation: status
   badge and the reason, plus a link to the sandbox where one exists.
5. **Investigation cards** — filter (phase, simulation status) and sort
   (score, name, tests) above the card grid.
6. **Moon-base scenario** (`MoonBaseCard.tsx`) — an extrapolation card, with an
   accent border. See §6.
7. **Stated assumptions** (`Assumptions`) — the three reference values with
   their sources and rules.

Two half-width widgets placed next to each other share a row; everything else
gets a row of its own (`layoutRows`). Collapsed widgets show a one-line summary
in their header (e.g. the ranking's top three). Every widget can be collapsed
and closed; a closed one is brought back by its chip in the layout bar.

### Layout bar and persistence

`LayoutBar.tsx` is a sticky toolbar above the widgets: one chip per widget.

- Click a chip (or Enter/Space) to show/hide its widget.
- Drag a chip by its `⠿` handle to reorder (pointer events, so mouse, touch and
  pen all work; no drag-and-drop library).
- Alt+Left / Alt+Right moves a chip one place; a live region announces where it
  went.
- "Reset layout" restores the default.

The layout is saved to `localStorage` under `psi-layout-v1` after it has been
read, so the default never overwrites a saved one; a broken or missing value
falls back to the default (`parseLayout`). The save is wrapped in `try/catch`:
if storage is unavailable the layout simply lasts the visit.

---

## 6. The Moon-base scenario (extrapolation)

`MoonBaseCard.tsx`, driven by `moonBase` in `psi.json`. It is labelled
**extrapolation**, and it says first what the data cannot support:

- No solid-material test in these tables goes above 22.2% O₂ (BASS-II); the
  scenario is 34% O₂ (the top of the exploration range) at 0.17 g.
- Pressure isn't modelled: the sandbox engine runs at 1 atm.

It then counts, from the cleaned tables, what the PSI data does hold at 30% O₂
or more: per investigation, how many tests/test days, how many at 34%, how many
at 0.7 atm or less, and the outcomes there. All of those rows are gas flames or
fuel droplets, not cabin solids — the card says so.

Finally it offers a sandbox what-if: BASS-II test B1 as NASA ran it, with only
the oxygen raised and gravity set to 0.17 g. The result is printed on the card
(`MOON_RESULT`, measured from the engine: the sample was fully consumed by step
1271, against still-burning at step 1500 in NASA's conditions) and a link runs
it live in the sandbox (`?tab=sandbox&scenario=moon`).

---

## 7. Links into the tab

`Workspace` passes a `links` object (built in `workspace/links.ts`) so other
tabs can drive this one:

- `?tab=investigations&card=<id>` — `showCard(id)` reveals the cards widget if
  it was closed, clears the phase/status filters, scrolls to the card, and
  opens its details drawer.
- The Overview tab's "How BASS-II ranks among NASA's 14 PSI combustion
  investigations…" link opens the BASS-II card.
- `CardLinks` (in `Investigations.tsx`) puts sandbox links inside a card's
  details: BASS-II charts/data table, BASS-II presets, Saffire presets, and the
  CFI-G gas-flame demo.
- `Simulated.tsx` links BASS-II, Saffire and CFI-G to the sandbox.

---

## 8. The AI interpretation

`AiSummary.tsx` calls `/api/psi-interpretation?id=<investigation id>` (or
`id=overall` for the ranking). Behaviour:

- The ranking summary (`auto`) asks as soon as the widget renders.
- A card's summary waits for its **Explain <name>** button, so a visit costs at
  most one paid call until someone asks for more.
- The response is shown as **AI interpretation (model), from the data shown
  here** when the model's answer passes the checks, otherwise as a **plain
  summary from the data**, with a line saying why the AI answer was replaced.

The server (`src/lib/psi-ai.ts` + `src/lib/ai-guard.ts`) is strict:

- The model is fixed server-side; the browser cannot choose it.
- The model is sent only that card's facts (or the ranking's), never the raw
  tables, and is told to use only those facts.
- Any number in the answer that is not in the facts (`numbersNotInFacts`)
  replaces the answer with the plain summary — the guard against invented
  figures.
- The overall summary must name at least three investigations and avoid vague
  phrases ("higher scores indicate", "in general", …); a card's summary must
  name its own investigation (`tooGeneral`).
- The overall summary's interpretations must sit under "What separates them" or
  be explicitly marked ("This suggests…") (`unmarkedInterpretation`).
- Rate limits and cache: at most 10 new requests per 10 minutes per visitor, at
  most 300 paid calls per UTC day across everyone, and answers are cached by
  exactly what was sent, so repeats are free.

The plain fallback (`psiFallback`) is built from the same facts, so the tab is
never empty when the AI is off or an answer is rejected.

---

## 9. What we simulated

`Simulated.tsx` and the status badge on every card come from `simulation` in
`psi.json` (written by `psi-catalogue.ts`, checked against the cleaned tables
and the sandbox's own notes). Four statuses, in this order on screen:

- **Simulated and scored** — BASS-II: 129 presets; NASA states an outcome for
  26; the sandbox matches 4 (B14, B18, B19, O4).
- **Simulated, compared by hand** — Saffire I-III: 6 runnable presets, 0 of 6
  reproduce NASA's burn times/spread rates; the 4 silicone samples are skipped
  (the engine has no silicone).
- **Built, not testable** — CFI-G (ACME): 43 gas-flame presets run, none keeps a
  flame going; the likely cause is the 2 mm cell, and only the visual demo
  shows a flame.
- **Not simulated** — the other 11, each with a written reason (droplet flames
  have no model; gas flames don't hold at 2 mm; smoke is a single material
  with no particles; the table holds conditions but no outcomes; …).

The widget's header line summarises the counts, and the sandbox links are only
offered where the sandbox can actually load the investigation.

---

## 10. Files

```
src/app/(frontend)/dashboard/components/investigations/
  Investigations.tsx      the tab: filters, cards, widget layout, links
  CompactCard.tsx         one card in the grid
  InvestigationCard.tsx   the full card (details drawer body)
  CardDrawer.tsx          the right-hand dialog, focus trap, Esc/backdrop close
  Widget.tsx              one collapsible panel with a header summary
  LayoutBar.tsx           the chip toolbar (show/hide, drag, Alt+arrows, reset)
  Ranking.tsx             RankingList, WeightsPanel, Assumptions
  Simulated.tsx           the "What we simulated" table + StatusBadge
  MoonBaseCard.tsx        the Moon-base extrapolation card
  AiSummary.tsx           the /api/psi-interpretation panel
  psi.json                the data (generated — do not edit by hand)

src/lib/psi.ts            types, CRITERIA, HABITAT_REFERENCE, rank(), rankLabel(), testsLabel()
src/lib/psi-ai.ts         prompts, facts for the model, plain fallback, answer guards
src/lib/widget-layout.ts  the pure widget-layout reducer + parseLayout
src/lib/ai-guard.ts       model, rate limits, daily cap, cache (shared with the other AI routes)
src/scripts/psi-catalogue.ts  builds psi.json from data/psi/ + scorecard.json + sources.json
data/psi/                 cleaned NASA tables, catalogue CSV, sources.json, READMEs
tests/int/psi-catalogue.spec.tsx  psi.json == build(), card rendering, facts, sources
tests/int/psi-widgets.spec.tsx    layout reducer, layout bar, cards, filters, saved layout
tests/int/psi-ai.spec.ts          prompts, facts, fallback, number/specificity guards
```

## 11. Invariants worth keeping

- **psi.json is generated.** Edit `psi-catalogue.ts` or `data/psi/`, then rerun
  the script; the test compares the file to a fresh build.
- **Every number on a card is computed from a cleaned table**, and the card
  names its source (PSI id and cleaned file, plus any checked papers).
- **Tables without per-test outcomes say so** (`outcomeRecorded`,
  `testsLabel`) rather than implying tests that aren't there.
- **A score is never a risk rating**, and the Moon-base card is always labelled
  an extrapolation.
- **The sandbox's own result is quoted as the sandbox's**, not as NASA data
  (BASS-II's "Our simulator (not NASA data)" fact).
