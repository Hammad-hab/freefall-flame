# BASS-II test table, cleaned

Source: `PSI-25_Experimental table_BASS-II.csv` (NASA PSI). 129 tests, one row each.
Nothing was invented: every value comes from the source row, and the three `*_raw`
columns at the end keep the original text.

## Columns

| Column | Meaning |
|---|---|
| test_id, investigator, date, gmt_day, sample_id | As in the source |
| fuel_material | PMMA, SIBAL fabric, Nomex fabric, or Wax |
| geometry | film (under 1 mm), slab, rod, fabric sheet, spherical section, candle |
| thickness_mm, width_cm | Films, slabs and fabric, where stated |
| rod_diameter_mm, rod_colour | Rods only (1/4, 3/8, 1/2 inch converted) |
| burn_sides | "one" or "two" where the source says so |
| flow_restrictor | As in the source (0, 1 or 2) |
| air_steps | The "Air display" readings (cm/s) in order, e.g. `5 > 3 > 2` |
| air_start, air_min, air_max, air_last_listed | Taken from air_steps |
| air_trend_after_last | "falling" or "rising" when the source says the flow kept changing after the last number |
| outcome | See below |
| o2_*, co2_* (% by volume), co_* (ppm) | Before, after, and the change |
| co2_made_per_o2_used | CO2 rise / O2 drop, only when O2 fell by 0.5 points or more |
| co_as_pct_of_co2 | CO rise as a percentage of CO2 rise, only when CO2 rose by 0.3 points or more |
| flags | Every problem found in that row |

## Outcome labels

- `extinguished_low_flow` (17): the notes say the flame went out as flow was reduced.
- `blowoff_high_flow` (7): the notes say blowoff as flow was raised.
- `no_ignition` (1) and `not_sustained` (1).
- `not_stated` (103): the table does not say how the test ended. Do not read this as
  "burned to completion"; the videos and reports hold that information.

## Cautions

- "Air display" is the air velocity transducer reading in cm/s (confirmed in Olson et al.
  2015, ICES-2015-196, NTRS 20150019858). "Fan display" is fan voltage x10. The transducer
  took about one minute to respond, so readings right after a change lag the real flow.
- The duct reached about 55 cm/s with no flow restrictors and about 35 cm/s with two
  (the flow_restrictor column).
- Same paper: thin and thick slabs were burned in opposed flow (flame spreading into the
  oncoming air); rods were burned both opposed and concurrent.
- Gas readings were taken in the sealed glovebox working volume (about 0.25 m3) before
  and after a test, so O2 fell and CO2 and CO built up across repeated tests. Compare
  ratios and outcomes with the simulator, not absolute changes.
- 47 rows carry a flag. Implausible final O2 readings (1.6, 0.6, 0.9, 39.1, 40.4) were
  blanked. Two dates say 2018 and are probably 2014. Three rows have fan and air
  values swapped or merged in the source and were read by hand.
- "<1" in the air column is stored as 0.5.

## Two numbers for the engine

- PMMA makes a median of 0.82 CO2 per O2 used (50 tests), against 0.83 from the
  chemistry (5 CO2 per 6 O2).
- CO rise is a median of 3.5% of the CO2 rise (51 tests, range 0.2% to 6.4%).

## Source for units and set-up

Olson, Ferkul, Bhattacharjee, Miller, Fernandez-Pello, Link, T'ien and Wichman,
"Results from on-board CSA-CP and CDM Sensor Readings during the Burning and Suppression
of Solids - II (BASS-II) Experiment in the Microgravity Science Glovebox (MSG)",
ICES-2015-196, 2015. NTRS 20150019858.
