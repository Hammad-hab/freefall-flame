# Data Flow: From CSV to Chart

This document traces the complete path data takes from a raw CSV file to an
interactive chart in the browser.

## 1. CSV Import (Admin)

An administrator uploads a CSV file through the Payload admin panel. The
import process (`src/scripts/import-csv.ts`) parses the CSV, creates a
Dataset document with column definitions, and stores each row as a DatasetRow
document in Postgres.

```
CSV File
  │
  ▼
src/scripts/import-csv.ts
  │
  ├── Creates Dataset document (name, columns, papers)
  └── Creates DatasetRow documents (data, rowIndex, sourcePage, rawData)
```

**Key detail:** The `rawData` field on each row preserves the original text
for readings that could not be stored as numbers (e.g., ">500", "OR"). This
is critical for distinguishing censored readings from missing values.

## 2. Dataset Loading (Server)

When a user visits `/dashboard?dataset=<id>`, the server component calls:

```
getDataset(id)  →  DatasetMeta { id, name, columns, papers, rowCount, ... }
getAllRows(id)  →  DataRow[]   { _id, _paper, _rawData, ...columnValues }
```

Both functions use Payload's local API with `overrideAccess: false` to
enforce the published-only access rule. Results are cached for 60 seconds.

## 3. Column Resolution (Server)

The dataset's column definitions are passed to `resolveBass2Columns()`:

```
columns: Column[]
  │
  ▼
resolveBass2Columns(columns)
  │
  ├── For each role (material, o2Initial, o2Final, coInitial, ...):
  │     1. Check admin canonical mapping
  │     2. Try exact key match
  │     3. Try exact label match
  │     4. Try unique fuzzy substring
  │     5. Flag ambiguous if multiple matches
  │
  ▼
{ resolutions: Record<role, ColumnResolution>, warnings: string[] }
```

**Example:** The role `o2Initial` might resolve to a column with key
`calibrated_initial_o2` and label `Calibrated initial O2`.

## 4. Row Parsing (Server)

`parseRows()` transforms raw `DataRow[]` into `ParsedRow[]`:

```
DataRow[] + RowMapping
  │
  ▼
parseRows(rows, mapping)
  │
  ├── For each row:
  │     ├── Classify each gas reading (valid/missing/censored/outOfRange/invalid)
  │     ├── Compute O₂ consumed = o2i - o2f (only if both valid and different columns)
  │     ├── Compute CO produced = cof - coi (only if both valid)
  │     └── Compute CO₂ produced = co2f - co2i (only if both valid)
  │
  ▼
ParsedRow[] { material, o2i, o2f, o2Consumed, coProduced, co2Produced, readingClasses, ... }
```

**Reading classification:**

| Class        | Meaning                                    | Example        |
| ------------ | ------------------------------------------ | -------------- |
| `valid`      | Finite number                              | `20.9`         |
| `missing`    | Empty or "N/A"                             | `""`, `"N/A"`  |
| `censored`   | Sensor saturation marker                   | `"OR"`, `"sat"`|
| `outOfRange` | Comparison marker (one-sided bound)        | `">500"`       |
| `invalid`    | Unparseable text                           | `"error"`      |

## 5. Metrics & Scoring (Server or Client)

`computeMaterialMetrics()` groups parsed rows by material:

```
ParsedRow[]
  │
  ▼
computeMaterialMetrics(rows, bands)
  │
  ├── Group by material
  ├── Count tests, distinct O₂ conditions, O₂ range
  ├── Compute mean O₂ consumed, mean CO, mean CO₂
  └── Count excluded readings (censored + outOfRange + missing)
  │
  ▼
MaterialMetrics[] { material, tests, o2Conditions, o2Range, o2ConsumedMean, excluded, ... }
```

`computeEvidenceScores()` produces the final ranking:

```
MaterialMetrics[] + EvidenceWeights
  │
  ▼
computeEvidenceScores(metrics, weights)
  │
  ├── Normalize weights to sum to 1
  ├── For each material, compute components (0-100):
  │     ├── testCoverage = (tests / maxTests) × 100
  │     ├── o2Diversity = (o2Conditions / maxConditions) × 100
  │     └── o2Range = (o2Range / maxRange) × 100
  ├── Drop null components, renormalize remaining weights
  ├── Compute weighted score
  └── Assign competition ranking (tied scores share rank)
  │
  ▼
ScoredMaterial[] { material, score, rank, components, ... }
```

## 6. Client-Side Rendering

Client components receive `ParsedRow[]`, `DatasetMeta`, and `DataRow[]` as
props. They use `useMemo` for derived chart data and `useState` for
interactive controls.

```
ParsedRow[] ──→ EvidenceRanking (weight sliders, sort controls)
ParsedRow[] ──→ OxygenHeatmap (band width, sort controls)
ParsedRow[] ──→ Visualization (material/flow filters, chart data)
DataRow[]   ──→ DataTable (raw values with censored markers)
```

## 7. AI Interpretation (Optional)

When `OPENROUTER_API_KEY` is configured, the interpretation panel fetches a
grounded summary from `/api/interpretation`:

```
ParsedRow[]
  │
  ▼
summarizeForInterpretation(rows, datasetName)
  │
  ├── Compute material metrics (same as step 5)
  ├── Build compact summary (no raw rows)
  └── Include paper references
  │
  ▼
InterpretationSummary → /api/interpretation → InterpretationPanel
```

The AI receives only the compact summary — never raw rows — ensuring no
unsupported claim can hide in the payload.
