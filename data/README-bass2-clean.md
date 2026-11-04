# BASS-II (cleaned): the clean test table as a dataset

The dashboard's first BASS-II dataset ("BASS-II", id 2) was imported from
`data/PSI-25_BASS-II_cleaned.csv` with `src/scripts/import-csv.ts`, which guesses
each column's type. In it:

- 57 tests have material "unknown": 50 PMMA rods, 5 PMMA films and 2 PMMA
  spherical sections;
- rod diameters are stored as "thickness", and "unknown" is a stored value for
  colour (72 rows) and width (58);
- five impossible final O2 readings are kept (1.6, 0.6, 0.9, 39.1, 40.4 %);
- every date is one day early in UTC (local midnight at UTC+5 was stored);
- there is no outcome column.

The clean table, `nasa-project/data/bass2_tests_clean.csv` (with its README,
`bass2_tests_clean_README.md`), fixes these without inventing anything. It is
imported as a **new** dataset, "BASS-II (cleaned)", next to the old ones. No
collection or schema changes: a dataset defines its own columns.

## The scripts

Both run with Payload's runner from the repo root:

```
pnpm payload run src/scripts/export-datasets.ts
pnpm payload run src/scripts/import-bass2-clean.ts              # dry run
pnpm payload run src/scripts/import-bass2-clean.ts -- --write   # create it, unpublished
pnpm payload run src/scripts/import-bass2-clean.ts -- --check   # read it back and check
```

- `export-datasets.ts` writes a backup (below). It only reads the database.
- `import-bass2-clean.ts`:
  - the 35 columns are written out in the script, with the keys the dashboard
    already reads (`lib/combustion.ts`, `resolveBass2Columns`), so the charts,
    Overview and AI panel work without code changes;
  - standard fields: `material`, `outcome`, starting air velocity (`flowCmS`) and
    initial O2 (`o2Percent`);
  - dates are stored at 12:00 UTC, the same calendar day everywhere; the two 2018
    dates stay as in the source, with their flag;
  - readings the source had as text ("none", ">500", "OR", "over") are kept in
    `rawData`, from the `flags` column, so censored readings are still counted;
  - rows link to Olson et al. 2015 (NTRS 20150019858); the dataset to that and the
    2021 summary report;
  - `--write` creates the dataset **unpublished**, in one transaction, and refuses
    if the name exists. It changes nothing else.

The checks (dry run, and `--check` from the database): 129 rows; outcomes
not_stated 103, extinguished_low_flow 17, blowoff_high_flow 7, no_ignition 1,
not_sustained 1; materials PMMA 98, SIBAL fabric 27, Nomex fabric 3, Wax 1; 54 rods;
no "unknown" anywhere; 7 blank final O2 readings; every O2 reading within 10-30 %;
47 flagged rows; every date at 12:00 UTC; and, with `--check`, every stored row
equal to its CSV row, unpublished, rows linked to the paper.

## Backup and restore

`export-datasets.ts` writes `.local-checks/backup/datasets-<UTC time>.json`
(git-excluded): every dataset (published or not), row, import record and paper,
exactly as stored, with counts.

Restoring:

- **Switching back** needs no backup: the import changes nothing old. Untick
  "published" on "BASS-II (cleaned)" and tick it on "BASS-II" in /admin.
- **If old data were ever lost**, a restore script (not written; write it only if
  needed) would read the backup file and, for each dataset missing from the
  database, create it with the same name, description, papers, columns and
  published flag, then its rows with the same rowIndex, data, rawData and
  sourcePaper, in one transaction, with a dry run by default. Ids would be new, so
  links to `?dataset=<old id>` would change.

## Preview before publishing (local only)

An unpublished dataset is "Dataset not found" for visitors, including on
`/dashboard?dataset=<id>`. To look at it first, start the dev server with
`DATASET_PREVIEW_IDS=<id>` (comma-separated). This only works in `next dev`, never
in a production build, and nothing a visitor sends can turn it on.

## Making it the default (not done yet)

The dashboard opens the first published dataset whose name contains "BASS",
sorted by name. Publishing "BASS-II (cleaned)" and unpublishing "BASS-II" (id 2)
and "BASS-II CSV Sample" (id 1) makes it the default. The list is cached for 60
seconds.
