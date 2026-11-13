// nasaReadings.ts - NASA's glovebox gas readings for a preset, taken from the
// dashboard's dataset row for the same test. No React, no DOM.
//
// Why not the engine's own values: flame-core marks "no reading" with -1.0
// (FC_NO_READING), and 11 BASS-II tests have a real initial CO reading of
// -1.0 ppm (a sensor offset). From the engine alone the two can't be told
// apart, so the sandbox reads the dataset row, where a blank is a blank and
// -1.0 is -1.0. The engine's values are used only when the dataset has no row
// for the test (or lacks the columns), and say so.

import { resolveBass2Columns, resolveColumn, type ColumnLike } from '@/lib/combustion';
import type { DataRow } from '@/lib/types';
import { NO_READING, READING } from '../engine/Engine';

/** One reading: a number, or null with the source's text if it had any ("none", ">500"). */
export interface Reading {
  value: number | null;
  sourceText: string | null;
}

export interface PresetReadings {
  /** 'dataset': the dataset row for this test; 'engine': flame-core's preset table. */
  source: 'dataset' | 'engine';
  /** In engine READING order: O2 before/after, CO2 before/after, CO before/after, CO2 per O2. */
  readings: Reading[];
  /** The row's flags column ('' when none, or when the source is the engine). */
  flags: string;
}

/** The dataset's readings by test id, or null if it lacks a test-id or reading column. */
export type ReadingIndex = Map<string, PresetReadings>;

// The roles resolveBass2Columns knows, in READING order (the CO2-per-O2 ratio is found below).
const GAS_ROLES = ['o2Initial', 'o2Final', 'co2Initial', 'co2Final', 'coInitial', 'coFinal'] as const;

export function buildReadingIndex(columns: ColumnLike[], rows: DataRow[]): ReadingIndex | null {
  const { resolutions } = resolveBass2Columns(columns);
  const testKey = resolutions.testNo?.column?.key;
  const keys: (string | undefined)[] = GAS_ROLES.map((r) => resolutions[r]?.column?.key);
  keys.push(resolveColumn(columns, { role: 'co2PerO2', exactKeys: ['co2_per_o2_used'], exactLabels: ['CO2 made per O2 used'] }).column?.key);
  if (!testKey || keys.some((k) => !k)) return null;
  const flagsKey = resolveColumn(columns, { role: 'flags', exactKeys: ['flags'], exactLabels: ['Flags'] }).column?.key;

  const index: ReadingIndex = new Map();
  for (const row of rows) {
    const test = row[testKey];
    if (typeof test !== 'string' || test === '' || index.has(test)) continue;
    const raw = (row._rawData ?? {}) as Record<string, unknown>;
    index.set(test, {
      source: 'dataset',
      readings: keys.map((k) => {
        const v = row[k!];
        const text = raw[k!];
        return {
          value: typeof v === 'number' && Number.isFinite(v) ? v : null,
          sourceText: typeof text === 'string' && text !== '' ? text : null,
        };
      }),
      flags: flagsKey && typeof row[flagsKey] === 'string' ? (row[flagsKey] as string) : '',
    });
  }
  return index;
}

/** The readings for a test: its dataset row, or else the engine's values (-1.0 read as "no reading"). */
export function readingsFor(index: ReadingIndex | null, testId: string, engineReadings: number[]): PresetReadings {
  const row = index?.get(testId);
  if (row) return row;
  const readings: Reading[] = [];
  for (let r = 0; r < READING.COUNT; r++) {
    const v = engineReadings[r];
    readings.push({ value: v === undefined || v === NO_READING || !Number.isFinite(v) ? null : v, sourceText: null });
  }
  return { source: 'engine', readings, flags: '' };
}

/** "-1.0 ppm", "not recorded", or 'not recorded ("none" in source)'. */
export function formatReading(r: Reading, digits: number, unit: string): string {
  if (r.value !== null) return `${r.value.toFixed(digits)}${unit}`;
  return r.sourceText ? `not recorded ("${r.sourceText}" in source)` : 'not recorded';
}
