# The sandbox's scorecard

The sandbox shows how many NASA-scored BASS-II tests its engine matches
("4 of 26 scored tests match NASA"). "Scored" means NASA's table says how
the test ended; for the other 103 of the 129 tests it says nothing, so they
can't be scored.

## Files

- `src/app/(frontend)/dashboard/components/sandbox/scorecard.json`: the
  result, precomputed, because running every scored preset to the end takes
  minutes. Written by:

  ```
  node --import tsx/esm src/scripts/sandbox-scorecard.ts           # write it
  node --import tsx/esm src/scripts/sandbox-scorecard.ts --check   # rerun and compare, write nothing
  ```

  The script runs the dashboard's own engine files (`sandbox/engine/`) and
  match rule (`sandbox/engine/scoring.ts`), each preset with its default
  lighting, to the end of its timeline. It needs no database or network.
  The file also lists the 129 preset test ids, which the Data Table uses for
  its "Open in sandbox" links.

- `data/bass2_all_outcomes.csv`: the engine project's own scorecard, copied
  unchanged from `nasa-project/exports/bass2_all_outcomes.csv` (written by its
  `make presets`; SHA-256 `4a9ca207…a448`). Columns: test_id, fidelity,
  nasa_outcome, sim_outcome, match (yes / no / blank = not scored).

## The check

`tests/int/sandbox-scorecard.spec.ts` checks that `scorecard.json`

- has the same scored tests, outcomes and match results as
  `bass2_all_outcomes.csv`, and the same 129 test ids;
- gives each test the verdict `scoring.ts` gives its stored outcome;
- was made with the engine file now in `sandbox/engine/flame_core.wasm`
  (its SHA-256). After an engine swap the test fails until the script is
  rerun.
