# The PSI catalogue

NASA's Physical Sciences Informatics (PSI) system holds 14 combustion
investigations. The dashboard's catalogue gives each one a card: what was
burned, the oxygen, pressure and flow, the number of tests, the outcomes,
facts computed from its cleaned table, and its sources.

## Files

- `data/psi/*.csv` and the three `README_*.md` / `*_README.md` files: the
  cleaned tables and their notes, copied unchanged from `nasa-project/data/`
  (see those READMEs for every cleaning step and flag).
  `investigations_catalogue.csv` is the one-row-per-investigation summary.
- `data/psi/sources.json`: hand-checked papers per investigation. Every card
  already cites its PSI id; add a paper here only after checking its title,
  NTRS id and link. At present it lists BASS-II's two NTRS papers.
- `src/app/(frontend)/dashboard/components/investigations/psi.json`: the
  catalogue the dashboard shows. Written by:

  ```
  node --import tsx/esm src/scripts/psi-catalogue.ts           # write it
  node --import tsx/esm src/scripts/psi-catalogue.ts --check   # rebuild and compare, write nothing
  ```

  No database and no network. Do not edit psi.json by hand: change the
  script or `sources.json` and rerun.

## What the script checks

- Where a table has one row per test ("per test", "per sample", "per run",
  "per flame condition"), the catalogue's test count must equal the rows.
- Every investigation must have its facts declared, and `sources.json` may
  only name investigations in the catalogue.

`tests/int/psi-catalogue.spec.tsx` checks that psi.json is exactly what the
script builds, that every card cites its PSI id, and a few counts (BASS-II's
26 stated outcomes, FLEX's 186 / 61 / 27, CFI-G's 115 normal flames at 30%
O2 or more).

## The habitat fire-safety ranking

The same script scores each investigation on five criteria, 0, 1 or 2, and
writes each score with its reason into psi.json. The rules are in
`CRITERIA` and the script; criteria a-d are computed from the catalogue row,
e is our judgement, written in the script with its reason.

| Criterion | 2 | 1 | 0 |
|---|---|---|---|
| a. Habitat materials | spacecraft solids (PMMA, SIBAL, Nomex, silicone, Kapton, Teflon, Ultem, Pyrell, lampwick) | gas flames emulating solids | model fuels only |
| b. Habitat atmosphere | covers ISS air and reaches the exploration atmosphere | one of the two | neither, or not in the table |
| c. Cabin airflow | overlaps 7.6-20 cm/s | still or slow air only (below 7.6 cm/s) | burner flow, coflow without a speed, or not given |
| d. Data richness | 100 tests or more, and outcomes recorded | one of the two | neither |
| e. Informs a decision (our judgement) | direct: prevention, detection or suppression at spacecraft conditions | indirect | fundamental science |

Reference values (stated assumptions, shown on screen with their sources):

- ISS: about 21% O2 at 1 atm (14.7 psia). Covered when the oxygen range
  overlaps 20.5-22.5% and the pressure range overlaps 0.95-1.05 atm.
- Exploration atmosphere: 32-34% O2 at 8.0-8.2 psia (0.54-0.56 atm); the
  Exploration Atmospheres Working Group recommended 8.0 psia / 32%, and
  8.2 psia / 34% is a proposed refinement (Norcross et al. 2013, NTRS
  20130013505). Reached at 30% O2 or more, or 0.7 atm or less.
- Cabin ventilation: typically about 7.6-20 cm/s (15-40 ft/min); the lower
  figure is the classic station minimum (SAE 932191).

The page ranks by score = sum(weight x criterion) / (2 x sum(weights)) x 100
(`rank()` in `src/lib/psi.ts`). The weights start at 1 each; the viewer can
set each from 0 to 3, and the page keeps them in that browser only. With
equal weights: BASS-II 90; Saffire and SAME-R 80; FLEX and SAME 70; CFI-G 60;
SPICE 50; BASS and BRE 40; CFI, Flame Design and FLEX-2 30; s-Flame 20; CLD
Flame 0. A score is relevance to habitat fire safety, not fire risk.

`tests/int/psi-ranking.spec.tsx` checks the reference values, that every
criterion is 0-2 with a reason, the ranking with equal weights, reweighting,
and that moving a slider reorders the list on screen.

## AI summaries

`/api/psi-interpretation?id=<investigation>` (or `id=overall`, the ranking at
equal weights) gives a plain-language summary. The model is sent only that
card's facts from psi.json (`psiFacts()` in `src/lib/psi-ai.ts`). If the
answer contains any number that is not in those facts, it is not shown; the
plain summary built from the same facts is shown instead, with a note. It
uses the same guard as the dataset interpretation: the fixed model, 10 new
requests per visitor per 10 minutes, 300 paid calls a day, and the in-memory
cache (one paid call per summary per server process).

The tab asks for the overall summary at once (1 paid call on the first
visit after a server start) and for a card's summary only when its "Explain"
button is pressed (1 each, at most 14). With custom weights there is no AI
call: a plain sentence gives the top three. Checked on 6 Nov 2026 with 3 real
calls (overall, BASS-II, FLEX): $0.0006642 together, every answer passed the
number check, and a repeat came from the cache.

## Moon-base scenario (an extrapolation)

A card for 34% O2 (the top of the exploration range) and the Moon's 0.17 g.
It says first that no solid-material test in these tables goes above
22.2% O2 (BASS-II; Saffire's highest is 22.1%) and that pressure isn't
modelled. The script then counts, from the cleaned tables, the tests at 30%
O2 or more: how many, how many at 34%, how many at 0.7 atm or less, and
their outcomes where the table has them (psi.json `moonBase`). At present:
CFI-G 115 normal flames (20 at 0.7 atm or less; 61 self-extinguished, 30
flow-terminated, 24 no ignition), FLEX 24 droplets (18 disruption, 4
completion, 2 extinction), Flame Design 131, BRE 17 test days, s-Flame 8
test days, FLEX-2 8 fuels (ranges only). All gas flames or droplets.

Its sandbox what-if (`?tab=sandbox&scenario=moon`) loads BASS-II test B1
(PMMA film 0.1 mm, air 5 cm/s) as NASA ran it, stops its timeline, sets only
the oxygen to 34% and gravity to 0.17 g, refills the chamber air, and plays
B1's own 1500 steps. No engine change. On 6 Nov 2026: burned out at step
1271, where B1 at NASA's conditions (22.2%, 0 g) is still burning at step
1500. Labelled "extrapolation: not validated above 22.2% O2; pressure is not
modelled (the engine runs at 1 atm)".

## Choices

- SPICE's air coflow range leaves out the 8 slightly negative readings the
  table flags as a sensor offset (0.66-85.28 cm/s, as in the catalogue).
- Saffire's microgravity spread rates are text in the table ("2.1 mm/s",
  "n/a", "Note 4"), so they are listed as written, not as a range.
- BASS-II's card adds one line on our simulator (4 of 26 scored tests
  match), labelled "not NASA data".
