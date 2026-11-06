# Cleaned NASA PSI tables: the remaining investigations, plus a catalogue

These tables are thinner than BASS-II, FLEX, Saffire and CFI-G. They are for the
dashboard's catalogue, comparison and ranking, not for calibrating the simulator.
Nothing was invented; every row keeps its problems in a `flags` column.

## investigations_catalogue.csv

One row per investigation (14 rows), built from the cleaned tables:
investigation, PSI id, fuel phase, hardware (as grouped in the challenge brief), number of
tests in the table, granularity (per test, per day or summary), fuels, oxygen range,
pressure range, flow range, whether outcomes are recorded, fire-safety theme, simulator
status, and the cleaned file. Oxygen and pressure ranges are computed from the data.
The fire-safety theme is our summary, based on the brief; check each against the
investigation's PSI page before quoting it.

## Per-investigation files

| File | Investigation | Rows | Notes |
|---|---|---|---|
| same_r_tests_clean.csv | SAME-R (PSI-101) | 109 | Smoke from 5 heated materials. "a" rows are aged-smoke readings of the run with the same number. Heater ratio Rt/R0 sets the heating level. Year not given. Smoke measurements are not in this table. |
| same_tests_clean.csv | SAME (PSI-102) | 8 | Rows 5-8 say "same conditions as 1-4"; not expanded. |
| bass_tests_clean.csv | BASS (PSI-26) | 121 | Dates and samples only; material and shape parsed from the sample name. No oxygen, flow or outcome. Two date typos flagged. |
| cfi_tests_clean.csv | CFI (PSI-39) | 79 | Dodecane droplet tests: pressure 0.5-5 atm, O2 17-21%, some with helium. 8 duplicated rows dropped. No outcomes. |
| flex2_summary_clean.csv | FLEX-2 (PSI-68) | 8 | Ranges per fuel only; no individual tests. |
| acme_bre_days_clean.csv | BRE (PSI-20) | 18 | One row per test day: burner size, fuel, oxygen levels used (21-40%), flames ignited. Two oxygen values written "3400%"/"2100%" read as 34 and 21. Pressure not given. |
| cld_flame_days_clean.csv | CLD Flame (PSI-21) | 32 | One row per test day. Fuel bottle names in the source were auto-incremented by a spreadsheet ("CH5", "C2H9"); restored to CH4 and C2H4. |
| acme_sflame_days_clean.csv | s-Flame (PSI-23) | 18 | One row per test day; N2 vs helium atmospheres at ~21% and ~30% O2. Auto-incremented "N3", "N4" restored to N2. |
| flame_design_tests_clean.csv | Flame Design (PSI-10) | 327 | Normal and inverse ethylene/propane flames, O2 20-85%, conditions only. Ramped tests have no single value. |
| spice_tests_clean.csv | SPICE (PSI-107) | 469 | Gas jet flames: fuel, nozzle, fuel rate, air coflow. Times with dots normalised; communication-loss times flagged; a few slightly negative air rates flagged (sensor offset). Smoke point not in this table. |

## What is not here

Outcomes for most of these investigations live in their reports and image data, not in the
summary tables. For the dashboard, cite each investigation's PSI page and reports for its
findings; use these tables for conditions, ranges and comparisons.
