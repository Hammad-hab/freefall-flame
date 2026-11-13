/**
 * The sandbox reads NASA's gas readings from the dataset row for the same test,
 * so a real -1.0 ppm reading is not mistaken for the engine's "no reading"
 * marker (FC_NO_READING = -1.0).
 */
import { describe, it, expect } from 'vitest'
import {
  buildReadingIndex,
  formatReading,
  readingsFor,
} from '@/app/(frontend)/dashboard/components/sandbox/view/nasaReadings'
import type { DatasetMeta, DataRow } from '@/lib/types'

// The reading columns of the cleaned BASS-II dataset (src/scripts/import-bass2-clean.ts).
const columns = [
  { key: 'test_no', label: 'Test No.', type: 'text' },
  { key: 'calibrated_initial_o2', label: 'Initial O2', type: 'number', unit: '%', canonicalField: 'o2Percent' },
  { key: 'calibrated_final_o2', label: 'Final O2', type: 'number', unit: '%' },
  { key: 'initial_co2', label: 'Initial CO2', type: 'number', unit: '%' },
  { key: 'final_co2', label: 'Final CO2', type: 'number', unit: '%' },
  { key: 'initial_co', label: 'Initial CO', type: 'number', unit: 'ppm' },
  { key: 'final_co', label: 'Final CO', type: 'number', unit: 'ppm' },
  { key: 'co2_per_o2_used', label: 'CO2 made per O2 used', type: 'number' },
  { key: 'flags', label: 'Flags', type: 'text' },
] as DatasetMeta['columns']

const base = { _id: 1, _index: 1, _paper: null, _page: null }
const rows: DataRow[] = [
  // B4: a real initial CO reading of -1.0 ppm (sensor offset), with its flag.
  { ...base, test_no: 'B4', calibrated_initial_o2: 22.2, calibrated_final_o2: 22.2, initial_co2: 0.44, final_co2: 0.51,
    initial_co: -1, final_co: 10, co2_per_o2_used: null, flags: 'initial CO below zero (sensor offset)' },
  // B14: final readings were text in the source ("none"), blank in the clean table.
  { ...base, _id: 2, test_no: 'B14', calibrated_initial_o2: 15, calibrated_final_o2: null, initial_co2: null, final_co2: null,
    initial_co: null, final_co: null, co2_per_o2_used: null, flags: 'final O2 not numeric in source ("none")',
    _rawData: { calibrated_final_o2: 'none' } },
]

// The engine's values for B4: -1 is both the real CO reading and FC_NO_READING.
const ENGINE_B4 = [22.2, 22.2, 0.44, 0.51, -1, 10, -1]

describe('NASA readings in the sandbox', () => {
  const index = buildReadingIndex(columns, rows)

  it('takes a -1.0 ppm reading from the dataset row as a reading, with its flag', () => {
    const r = readingsFor(index, 'B4', ENGINE_B4)
    expect(r.source).toBe('dataset')
    expect(formatReading(r.readings[4], 1, ' ppm')).toBe('-1.0 ppm')
    expect(formatReading(r.readings[5], 1, ' ppm')).toBe('10.0 ppm')
    expect(formatReading(r.readings[6], 2, '')).toBe('not recorded')
    expect(r.flags).toBe('initial CO below zero (sensor offset)')
  })

  it("shows a blank reading as not recorded, with the source's text when there was one", () => {
    const r = readingsFor(index, 'B14', [15, -1, -1, -1, -1, -1, -1])
    expect(formatReading(r.readings[0], 2, '%')).toBe('15.00%')
    expect(formatReading(r.readings[1], 2, '%')).toBe('not recorded ("none" in source)')
    expect(formatReading(r.readings[2], 2, '%')).toBe('not recorded')
  })

  it("falls back to the engine's values when the dataset has no row for the test", () => {
    const r = readingsFor(index, 'SF1-S1', [21.5, -1, -1, -1, -1, -1, -1])
    expect(r.source).toBe('engine')
    expect(formatReading(r.readings[0], 1, '%')).toBe('21.5%')
    expect(formatReading(r.readings[4], 1, ' ppm')).toBe('not recorded')
    expect(r.flags).toBe('')
  })

  it('uses the engine for every test when the dataset lacks a reading column', () => {
    const noRatio = columns.filter((c) => c.key !== 'co2_per_o2_used')
    expect(buildReadingIndex(noRatio, rows)).toBeNull()
    expect(readingsFor(null, 'B4', ENGINE_B4).source).toBe('engine')
  })
})
