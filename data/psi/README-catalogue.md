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

## Choices

- SPICE's air coflow range leaves out the 8 slightly negative readings the
  table flags as a sensor offset (0.66-85.28 cm/s, as in the catalogue).
- Saffire's microgravity spread rates are text in the table ("2.1 mm/s",
  "n/a", "Note 4"), so they are listed as written, not as a range.
- BASS-II's card adds one line on our simulator (4 of 26 scored tests
  match), labelled "not NASA data".
