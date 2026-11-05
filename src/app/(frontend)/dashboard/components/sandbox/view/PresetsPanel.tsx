// PresetsPanel.tsx - the flame-core preset browser: a filterable list of all
// 129 NASA BASS-II presets, a detail card, and Load / Stop controls.
//
// The catalogue is re-read from the `Engine` object on each render; filters
// below are client-side over that catalogue. The panel owns its own state
// (search + material / outcome / fidelity pickers).
//
// Light and play behaviour: `engine.loadPreset(id, lighting)` starts the
// preset's timeline (it does NOT auto-step). "Load & Run" then plays it;
// "Load (standby)" leaves it paused. `engine.stopPreset()` aborts the
// timeline and keeps the world intact. The sandbox never steps past the end
// of the timeline: it pauses exactly at `runSteps`.
//
// The live block (status line, our outcome, NASA's outcome, the match) is
// read from the engine four times a second while a preset is loaded.
//
// NASA's gas readings in the detail card come from the dashboard's dataset
// row for the same test (nasaReadings.ts), not from the engine: the engine's
// "no reading" marker (-1.0) is also a real CO reading in 11 tests.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Engine, NASA, type Light, LIGHT, type PresetInfo } from '../engine/Engine';
import { matchVerdict, type Verdict } from '../engine/scoring';
import { formatReading, readingsFor, type ReadingIndex } from './nasaReadings';
import scorecard from '../scorecard.json';
import { C, panelCls, panelStyle } from '../../ui/chart-theme';

/** How often the live block re-reads the engine. */
const LIVE_MS = 250;

// The precomputed scorecard (src/scripts/sandbox-scorecard.ts): each scored
// test's result with its default lighting, run to the end of its timeline.
const SCORECARD = new Map(scorecard.tests.map((t) => [t.testId, t.verdict as Verdict]));
const SCORECARD_TITLE = 'Precomputed: this preset with its default lighting, run to the end of its timeline';

// ---- Filter pickers ----------------------------------------------------

interface FilterState {
  search: string;
  material: string;
  outcome: string;
  fidelity: string;
}

const OUTCOME_PICK: { value: string; label: string }[] = [
  { value: 'all', label: 'All NASA outcomes' },
  { value: 'states', label: 'NASA states an outcome' },
  { value: 'not_stated', label: 'Not stated' },
  { value: 'went_out_low_flow', label: 'Went out, low flow' },
  { value: 'blowoff', label: 'Blow-off' },
  { value: 'no_ignition', label: 'No ignition' },
  { value: 'not_sustained', label: 'Would not stay lit' },
];

const FIDELITY_PICK: { value: string; label: string }[] = [
  { value: 'all', label: 'All fidelities' },
  { value: 'FULL', label: 'FULL' },
  { value: 'PARTIAL', label: 'PARTIAL' },
  { value: 'NOT MODELLED', label: 'NOT MODELLED' },
];

const MATERIAL_PICK: { value: string; label: string }[] = [
  { value: 'all', label: 'All materials' },
  { value: 'PMMA', label: 'PMMA' },
  { value: 'SIBAL', label: 'SIBAL' },
  { value: 'NOMEX', label: 'Nomex' },
  { value: 'WAX', label: 'Wax' },
];

// ---- Helpers -----------------------------------------------------------

// Map NASA outcome code to the filter key above.
const OUTCOME_KEYS: Record<number, string> = {
  [NASA.NOT_STATED]: 'not_stated',
  [NASA.WENT_OUT_LOW_FLOW]: 'went_out_low_flow',
  [NASA.BLOWOFF]: 'blowoff',
  [NASA.NO_IGNITION]: 'no_ignition',
  [NASA.NOT_SUSTAINED]: 'not_sustained',
};

const OUTCOME_LABELS: Record<string, string> = {
  all: 'All NASA outcomes',
  states: 'NASA states an outcome',
  not_stated: 'Not stated',
  went_out_low_flow: 'Went out, low flow',
  blowoff: 'Blow-off',
  no_ignition: 'No ignition',
  not_sustained: 'Would not stay lit',
};

const FIDELITY_LABELS: Record<string, string> = {
  all: 'All fidelities',
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  'NOT MODELLED': 'NOT MODELLED',
};

function matches(p: PresetInfo, f: FilterState): boolean {
  if (f.search) {
    const q = f.search.toLowerCase();
    const testHit = p.testId.toLowerCase().includes(q);
    const summaryHit = p.summary.toLowerCase().includes(q);
    if (!testHit && !summaryHit) return false;
  }
  if (f.material !== 'all' && p.materialName !== f.material) return false;
  if (f.outcome !== 'all') {
    if (f.outcome === 'states') {
      if (p.nasaCode === NASA.NOT_STATED) return false;
    } else if (OUTCOME_KEYS[p.nasaCode] !== f.outcome) {
      return false;
    }
  }
  if (f.fidelity !== 'all' && p.fidelityName !== f.fidelity) return false;
  return true;
}

/** What the live block shows, read from the engine. */
interface Live {
  id: number;
  step: number;
  runSteps: number;
  finished: boolean;
  airCmS: number;
  outcomeCode: number;
  outcomeName: string;
  outcomeStep: number;
}

function readLive(engine: Engine): Live | null {
  const s = engine.presetStatus();
  if (!s) return null;
  const o = engine.outcome();
  return {
    id: s.id, step: s.step, runSteps: s.runSteps, finished: s.finished, airCmS: s.airCmS,
    outcomeCode: o.code, outcomeName: o.name, outcomeStep: o.step,
  };
}

const sameLive = (a: Live | null, b: Live | null) =>
  a === b || (!!a && !!b && (Object.keys(a) as (keyof Live)[]).every((k) => a[k] === b[k]));

/** One-line status readout for the loaded preset. */
function StatusLine({ live, playing }: { live: Live | null; playing: boolean }) {
  if (!live) return <span style={{ color: C.muted }}>Select a preset, then Load &amp; Run.</span>;
  const run = live.finished ? 'finished' : playing ? 'running' : 'paused';
  return (
    <span className="tabular-nums" style={{ color: C.fg }}>
      {live.step} / {live.runSteps} &nbsp;·&nbsp; {live.airCmS.toFixed(1)} cm/s &nbsp;·&nbsp; {run}
    </span>
  );
}

const VERDICT_TONE: Record<Verdict, 'green' | 'red' | 'muted'> = {
  match: 'green', 'no match': 'red', pending: 'muted', 'not scored': 'muted',
};
const VERDICT_NOTE: Record<Verdict, string> = {
  match: '',
  'no match': '',
  pending: 'decided when the fire goes out or the run ends',
  'not scored': 'NASA states no outcome for this test',
};

/** Small tinted tag. */
function Tag({ value, tone = 'muted' }: { value: string; tone?: 'muted' | 'blue' | 'red' | 'green' }) {
  const toneStyle: Record<string, React.CSSProperties> = {
    muted: { color: C.muted, background: C.chip2 },
    blue: { color: C.fg, background: 'rgba(255,166,77,0.16)' },
    red: { color: 'rgba(248,113,113,0.85)', background: 'rgba(248,113,113,0.12)' },
    green: { color: 'rgba(52,211,153,0.85)', background: 'rgba(52,211,153,0.12)' },
  };
  return (
    <span
      className="inline-block rounded-[3px] px-1.5 py-0.5 text-[10px] tabular-nums"
      style={toneStyle[tone]}
    >
      {value}
    </span>
  );
}

// ---- Panel -------------------------------------------------------------

interface PresetsPanelProps {
  engine: Engine;
  /** Whether the sandbox is playing (for the status line). */
  playing: boolean;
  /** Called with (presetId, lighting, play): play true for "Load & Run",
   * false for "Load (standby)". */
  onLoad: (id: number, lighting: Light, play: boolean) => void;
  /** Called to abort the running preset's timeline; the world is left intact. */
  onStop?: () => void;
  /** NASA's readings by test id, from the dashboard's dataset (null: use the engine's). */
  readingIndex?: ReadingIndex | null;
  /** The dataset's name, to say where the readings come from. */
  datasetName?: string | null;
}

export default function PresetsPanel({ engine, playing, onLoad, onStop, readingIndex = null, datasetName = null }: PresetsPanelProps) {
  const [f, setF] = useState<FilterState>({ search: '', material: 'all', outcome: 'all', fidelity: 'all' });
  const [selected, setSelected] = useState<number | null>(null);
  const [lighting, setLighting] = useState<Light>(LIGHT.OPPOSED);
  const [live, setLive] = useState<Live | null>(() => readLive(engine));

  // Re-read the engine while the panel is open, so the readout follows the run.
  const refresh = useCallback(() => {
    setLive((prev) => { const next = readLive(engine); return sameLive(prev, next) ? prev : next; });
  }, [engine]);
  useEffect(() => {
    const id = setInterval(refresh, LIVE_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const load = (id: number, play: boolean) => { onLoad(id, lighting, play); refresh(); };
  const stop = () => { onStop?.(); refresh(); };

  const count = engine.presetCount();
  const catalogue = useMemo(() => {
    const list: PresetInfo[] = [];
    for (let i = 0; i < count; i++) list.push(engine.preset(i));
    return list;
  }, [engine, count]);

  const shown = useMemo(() => catalogue.filter((p) => matches(p, f)), [catalogue, f]);

  const activePreset = useMemo(
    () => (selected === null ? null : catalogue.find((p) => p.id === selected) ?? null),
    [catalogue, selected]
  );
  const activeReadings = activePreset ? readingsFor(readingIndex, activePreset.testId, activePreset.readings) : null;

  // The loaded preset (may differ from the selected row) and its verdict.
  const livePreset = useMemo(
    () => (live ? catalogue.find((p) => p.id === live.id) ?? null : null),
    [catalogue, live],
  );
  const verdict: Verdict | null =
    live && livePreset ? matchVerdict(livePreset.nasaCode, live.outcomeCode, live.finished) : null;

  const select = (value: string, key: keyof FilterState, opts: { value: string; label: string }[]) => (
    <select
      value={value}
      onChange={(e) => setF({ ...f, [key]: e.target.value })}
      className="rounded-lg border border-line bg-panel2 px-2 py-2 text-[11px] outline-none focus:border-blue"
      style={{ color: C.fg, background: C.panel2, borderColor: C.line }}
    >
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0" style={{ color: C.muted }}>{label}</span>
      <span className="min-w-0 break-words text-right tabular-nums" style={{ color: C.fg }}>{value}</span>
    </div>
  );

  return (
    <div className={panelCls} style={panelStyle}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <input
          value={f.search}
          onChange={(e) => setF({ ...f, search: e.target.value })}
          placeholder={`search ${catalogue.length} presets`}
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel2 px-3 py-2 text-[12px] leading-5 outline-none focus:border-blue"
          style={{ color: C.fg, background: C.panel2, borderColor: C.line }}
        />
        {select(f.material, 'material', MATERIAL_PICK)}
        {select(f.outcome, 'outcome', OUTCOME_PICK)}
        {select(f.fidelity, 'fidelity', FIDELITY_PICK)}
      </div>

      {/* The honest scorecard: how many NASA-scored tests the engine matches. */}
      <div id="preset-scorecard" className="mt-2 text-[11px] leading-5" title={SCORECARD_TITLE}>
        <div className="tabular-nums" style={{ color: C.fg }}>
          {scorecard.matched} of {scorecard.scored} scored tests match NASA ({scorecard.matchedTests.join(', ')})
        </div>
        <div className="text-[10px]" style={{ color: C.muted }}>
          scored: NASA&apos;s table says how the test ended ({scorecard.scored} of {scorecard.presets}); the
          other {scorecard.presets - scorecard.scored} can&apos;t be scored.
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-2 text-[11px]" style={{ color: C.muted }}>
          No presets match the current filters.
        </p>
      ) : (
        <div className="mt-2 flex min-h-0 flex-col gap-3">
          {/* List */}
          <div className="max-h-56 shrink-0 space-y-1 overflow-y-auto pr-1">
            {shown.map((p) => {
              const on = selected === p.id;
              const tone: 'muted' | 'red' | 'green' =
                p.nasaOutcome.includes('blow-off') ? 'red' :
                p.nasaOutcome.includes('would not stay lit') ? 'green' : 'muted';
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p.id); setLighting(p.defaultLighting); }}
                  className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-[11px] transition-colors ${
                    on ? 'bg-line text-fg' : 'text-muted hover:bg-line/50 hover:text-fg'
                  }`}
                  style={on ? { borderLeft: '2px solid rgba(255,166,77,0.5)' } : {}}
                >
                  <span className="w-7 shrink-0 tabular-nums" style={{ color: C.muted, fontFamily: 'ui-monospace, monospace' }}>
                    {p.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium" style={{ color: C.fg }}>
                      {p.testId}: {p.summary}
                    </span>
                    <span className="block truncate text-[10px] tabular-nums" style={{ color: C.muted }}>
                      {p.fidelityName} · {p.shapeName}
                    </span>
                  </span>
                  <span className="shrink-0"><Tag value={p.nasaOutcome} tone={tone} /></span>
                  {SCORECARD.has(p.testId) && (
                    <span className="shrink-0" data-scorecard={SCORECARD.get(p.testId)} title={SCORECARD_TITLE}>
                      <Tag value={SCORECARD.get(p.testId)!} tone={VERDICT_TONE[SCORECARD.get(p.testId)!]} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
  
          {/* Live: the loaded preset, read from the engine while it runs */}
          {live && livePreset && verdict && (
            <div id="preset-live" className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: C.line }}>
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="font-medium" style={{ color: C.fg }}>{livePreset.testId}</span>
                <StatusLine live={live} playing={playing} />
              </div>
              <div className="space-y-1 text-[11px] leading-5">
                {row('Our outcome',
                  live.outcomeCode === 0 || live.outcomeStep === 0
                    ? live.outcomeName
                    : `${live.outcomeName} (step ${live.outcomeStep})`)}
                {row('NASA outcome', livePreset.nasaOutcome)}
                {row('Match', (
                  <span data-verdict={verdict}>
                    <Tag value={verdict} tone={VERDICT_TONE[verdict]} />
                    {VERDICT_NOTE[verdict] && (
                      <span className="mt-0.5 block text-[10px]" style={{ color: C.muted }}>{VERDICT_NOTE[verdict]}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detail: the selected row */}
          {activePreset ? (
            <div className="flex flex-col gap-3 border-t pt-3" style={{ borderColor: C.line }}>
              <div className="space-y-1 text-[11px] leading-5">
                {row('Selected', activePreset.testId)}
                {row('Sample', `${activePreset.materialName} ${activePreset.kindName}, ${activePreset.shapeName}`)}
                {row('Conditions', `${activePreset.thicknessMm > 0 ? activePreset.thicknessMm.toFixed(2) : '—'} mm · ${activePreset.oxygenPct.toFixed(1)} % O2`)}
                {row('Fidelity', activePreset.fidelityName)}
                {row('Rule', activePreset.rule || '—')}
                {row('Run', `${activePreset.runSteps} steps`)}
              </div>

              {activeReadings && (
                <div id="preset-readings" data-source={activeReadings.source} className="space-y-1 text-[11px] leading-5">
                  {row('NASA readings', (
                    <span style={{ color: C.muted }}>
                      {activeReadings.source === 'dataset'
                        ? `from ${datasetName ?? 'the dataset'}, test ${activePreset.testId}`
                        : 'from the engine\'s preset table (no dataset row for this test)'}
                    </span>
                  ))}
                  {row('O2 before → after', `${formatReading(activeReadings.readings[0], 2, '%')} → ${formatReading(activeReadings.readings[1], 2, '%')}`)}
                  {row('CO2 before → after', `${formatReading(activeReadings.readings[2], 2, '%')} → ${formatReading(activeReadings.readings[3], 2, '%')}`)}
                  {row('CO before → after', `${formatReading(activeReadings.readings[4], 1, ' ppm')} → ${formatReading(activeReadings.readings[5], 1, ' ppm')}`)}
                  {row('CO2 made per O2 used', formatReading(activeReadings.readings[6], 2, ''))}
                  {activeReadings.flags && row('Flags', activeReadings.flags)}
                </div>
              )}
  
              <div className="flex flex-wrap gap-2">
                {[
                  { key: LIGHT.OPPOSED, label: 'Opposed' },
                  { key: LIGHT.CONCURRENT, label: 'Concurrent' },
                ].map(({ key, label }) => {
                  const on = lighting === key;
                  return (
                    <button
                      key={label}
                      onClick={() => setLighting(key)}
                      className="rounded-full border px-3 py-1 text-[11px] transition-colors"
                      style={{
                        borderColor: on ? C.blue : C.line,
                        background: on ? C.blue : C.surface,
                        color: on ? C.ink : C.muted,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
  
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => load(activePreset.id, true)}
                  className="rounded-full border bg-amber/15 px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-amber/25"
                  style={{ borderColor: C.blue, color: C.fg }}
                >
                  Load &amp; Run
                </button>
                <button
                  onClick={() => load(activePreset.id, false)}
                  className="rounded-full border px-3 py-1.5 text-[11px] transition-colors hover:bg-line/50"
                  style={{ borderColor: C.line, color: C.muted }}
                >
                  Load (standby)
                </button>
                <button
                  onClick={stop}
                  className="rounded-full border px-3 py-1.5 text-[11px] transition-colors hover:bg-line/50"
                  style={{ borderColor: C.line, color: C.muted }}
                >
                  ⟲ Stop
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-1" style={{ color: C.muted }}>
              <p className="text-sm">No preset selected</p>
              <p className="text-[11px]">Pick a row to load and run it.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
