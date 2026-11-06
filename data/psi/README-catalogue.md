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

## Choices

- SPICE's air coflow range leaves out the 8 slightly negative readings the
  table flags as a sensor offset (0.66-85.28 cm/s, as in the catalogue).
- Saffire's microgravity spread rates are text in the table ("2.1 mm/s",
  "n/a", "Note 4"), so they are listed as written, not as a range.
- BASS-II's card adds one line on our simulator (4 of 26 scored tests
  match), labelled "not NASA data".
