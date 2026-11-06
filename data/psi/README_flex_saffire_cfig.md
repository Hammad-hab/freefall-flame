# Cleaned NASA PSI tables: FLEX, Saffire I-III, CFI-G

Nothing was invented. Every value comes from the PSI source table; problems are listed in
each row's `flags` column, and assumptions are spelled out below.

## flex_tests_clean.csv  (FLEX, PSI-69, 274 droplet tests, ISS 2009-2011)

Single fuel droplets (methanol or heptane) burning in still air, in the Combustion
Integrated Rack. Many tests added CO2 or helium to the chamber to study suppression.

| Column | Meaning |
|---|---|
| test_no, flex_id, date, gmt | As in the source (date converted to ISO) |
| fuel | methanol or heptane |
| pressure_mmhg, pressure_atm | Chamber pressure |
| x_o2, x_n2, x_co2, x_he | Starting gas mole fractions |
| diluent_added | CO2, He, or none (123, 50 and 101 tests) |
| d0_mm | Starting droplet diameter |
| d_ext_mm | Droplet diameter when the visible flame went out |
| burning_rate_k_mm2_s | Burning-rate constant K. The source header says "mm"; it is mm^2/s (see check below) |
| burn_time_s | Burn time |
| outcome | extinction (186), disruption (61), completion (27) |
| d2_law_time_s | Our check: (d0^2 - d_ext^2) / K, the burn time the d-squared law predicts |
| flags | Problems in that row |

Check of the unit: across 188 tests, measured burn time / d2_law_time_s has a median of
1.05, so K is in mm^2/s and the droplets follow the d-squared law closely.

Outcome words, as used by FLEX: extinction = flame went out with liquid left; completion =
the droplet burned away; disruption = the test was disturbed (for example the droplet
broke up or moved), so it is not a clean result.

Cleaning: the source file used Windows-1252 encoding; dashes meaning "no value" were
blanked. One pressure of 0 was blanked. 23 rows are flagged (extinction diameter 0 with
unclear meaning, approximate burn times, a repeated identifier, gas fractions not summing
to 1, one extinction diameter larger than the starting diameter).

## saffire_tests_clean.csv  (Saffire-I PSI-98, -II PSI-99, -III PSI-100; 13 samples)

Large-scale fires burned inside empty Cygnus cargo ships after they left the ISS.

| Column | Meaning |
|---|---|
| mission, sample | Saffire-I, -II or -III and the sample id |
| material, thickness_mm, length_cm, width_cm | The sample |
| flow_cm_s, flow_direction | Airflow speed and concurrent/opposed |
| o2_pct | Oxygen (Saffire-II: derived from CO2, per the source's note 1) |
| ignition_power_w, ignition_time_s, burn_time_s | Ignition and burn |
| ug_burn_length_cm, ug_spread_rate_mm_s | Microgravity results (Saffire-II) |
| earth_g_burn_length, earth_g_spread_rate | The same samples burned in normal gravity (Saffire-II) |
| notes, flags | Source notes and our assumptions |

Key results: Saffire-I's 94 x 40.6 cm fabric burned 420 s with the flow (concurrent) and
70 s against it (opposed). In Saffire-II, silicone did not sustain a flame in microgravity,
though thin silicone burned completely in normal gravity; SIBAL fabric spread at 2.1-2.6
mm/s; Nomex next to burning PMMA did not ignite.

Assumptions (flagged): Saffire-I's source gives thickness "0.37 cm" and length/width
swapped; read as 0.37 mm and 94 x 40.6 cm to match the other missions. Saffire-III's
".33 cm" thickness is kept as 3.3 mm but may be a unit slip. Two Saffire-II materials were
blank and are assumed from their neighbours. Saffire-III's table has no results.

## cfig_tests_clean.csv  (CFI-G, PSI-159, 333 gas-flame tests)

Gaseous fuels (ethane, propane, butane mixes) burning from a spherical porous burner in
the ACME hardware. "Normal" flames send fuel out of the burner into an oxygen-rich
chamber (179 tests); "inverse" flames send oxygen out into a fuel-filled chamber (154).

| Column | Meaning |
|---|---|
| flame_type | normal or inverse |
| day, test_id, fuel | As in the source (spaces removed from ids) |
| x_o2 | Oxygen mole fraction (normal: chamber before the test; inverse: in the burner flow) |
| x_o2_after | Chamber oxygen after the test (normal only) |
| fuel_fraction | Fuel fraction in the fuel stream (normal) or chamber (inverse) |
| pressure_bar | Chamber pressure, 0.5 to 3.3 bar |
| fuel_flow_mg_s, o2_flow_mg_s | Flow rates |
| adiabatic_flame_temp_k, z_st | Calculated by the investigators |
| hot_ignition, cool_flame | Ignition result; cool flame observed (normal only) |
| burn_time_s | Burn time |
| outcome | no_ignition, self_extinguished, flow_terminated, flash_only |
| peak_burner_temp_c, color, comments | As in the source |

Why it matters for habitats: 115 normal-flame tests ran at 30% oxygen or more (61 went out
on their own, 30 burned until the flow was cut, 24 did not ignite). That is the oxygen
range expected in Moon bases and rovers, which the BASS-II solid tests (max 22.2%) do not
reach.

Cleaning: the two "Normal Flames" source files were identical; one was used. 861 empty
rows in the inverse file were dropped. "#DIV/0!" values (zero fuel flow) were blanked and
flagged. Ignition values were normalised (Yes/yes/No/no/flash).
