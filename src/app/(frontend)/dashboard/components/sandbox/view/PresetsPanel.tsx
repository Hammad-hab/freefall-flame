// PresetsPanel.tsx - the flame-core preset browser: a filterable list of the
// presets in two groups, NASA's 129 BASS-II tests and the 10 Saffire tests
// (flame-core 1.1.0, ids 1000+; the 4 silicone ones are listed but can't
// load, and none is scored: NASA gives a burn time, not an outcome code),
// a detail card, and Load / Stop controls.
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Engine, NASA, FIDELITY, OUTCOME, PARAM, SAFFIRE_FIRST, WIND_PER_CM_S, type Light, LIGHT, type PresetInfo } from '../engine/Engine';
import { matchVerdict, type Verdict } from '../engine/scoring';
import { formatReading, readingsFor, type ReadingIndex } from './nasaReadings';
import scorecard from '../scorecard.json';
import { isPlainClick, linkProps, type WorkspaceLinks } from '../../workspace/links';
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
  /** preset; demo: the gas flame demo (no wind, no outcome, no match); moon: the Moon-base what-if (no NASA result, no match). */
  kind: 'preset' | 'demo' | 'moon';
  id: number;
  step: number;
  runSteps: number;
  finished: boolean;
  airCmS: number;
  outcomeCode: number;
  outcomeName: string;
  outcomeStep: number;
}

type ScenarioStatus = () => { step: number; runSteps: number; finished: boolean } | null;

function readLive(engine: Engine, scenarioStatus?: ScenarioStatus): Live | null {
  const s = engine.presetStatus();
  if (s) {
    const o = engine.outcome();
    return {
      kind: 'preset',
      id: s.id, step: s.step, runSteps: s.runSteps, finished: s.finished, airCmS: s.airCmS,
      outcomeCode: o.code, outcomeName: o.name, outcomeStep: o.step,
    };
  }
  const d = engine.cfigStatus();
  if (d) {
    return {
      kind: 'demo', id: d.id, step: d.step, runSteps: d.runSteps, finished: d.finished, airCmS: 0,
      outcomeCode: 0, outcomeName: '', outcomeStep: 0,
    };
  }
  const m = scenarioStatus?.();
  if (m) {
    const o = engine.outcome();
    return {
      kind: 'moon', id: -1, step: m.step, runSteps: m.runSteps, finished: m.finished,
      airCmS: engine.getParam(PARAM.WIND) / WIND_PER_CM_S,
      outcomeCode: o.code, outcomeName: o.name, outcomeStep: o.step,
    };
  }
  return null;
}

const sameLive = (a: Live | null, b: Live | null) =>
  a === b || (!!a && !!b && (Object.keys(a) as (keyof Live)[]).every((k) => a[k] === b[k]));

/** One-line status readout for the loaded preset. */
function StatusLine({ live, playing }: { live: Live | null; playing: boolean }) {
  if (!live) return <span style={{ color: C.muted }}>Select a preset, then Load &amp; Run.</span>;
  const run = live.finished ? 'finished' : playing ? 'running' : 'paused';
  return (
    <span className="tabular-nums" style={{ color: C.fg }}>
      {live.step} / {live.runSteps} &nbsp;·&nbsp; {live.kind === 'demo' ? 'flow cut at ' + live.runSteps : `${live.airCmS.toFixed(1)} cm/s`} &nbsp;·&nbsp; {run}
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

// ---- Saffire (flame-core 1.1.0) -----------------------------------------

type Group = 'bass' | 'saffire';
const isSaffire = (p: PresetInfo) => p.id >= SAFFIRE_FIRST;
/** Listed but cannot load (the 4 silicone tests: no silicone in the sandbox). */
const cannotLoad = (p: PresetInfo) => p.fidelity === FIDELITY.NOT_MODELLED;
const SAFFIRE_NOT_SCORED = 'NASA gives a burn time, not an outcome code';
// The Saffire runs compared with NASA's results by hand (engine project,
// docs/13a and exports/saffire_outcomes.csv). No rule scores them.
const SAFFIRE_NOTE =
  "Compared by hand: 0 of 6 reproduce NASA's result. Our SIBAL flames spread at least 3.2–4× faster, the opposed SF1-S2 flame didn't survive, and our PMMA flames spread instead of staying anchored at the base.";

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
      className="inline-block max-w-full truncate rounded-[3px] px-1.5 py-0.5 align-middle text-[10px] tabular-nums"
      style={toneStyle[tone]}
    >
      {value}
    </span>
  );
}

// ---- Panel -------------------------------------------------------------

/** What a link asks the panel to show: a preset by test id, or a group (nonce: new per click). */
export type PresetFocus =
  | { id: number | null; testId: string; group?: undefined; nonce: number }
  | { group: Group; id?: undefined; testId?: undefined; nonce: number };

// The PSI catalogue card for each group, and for the gas flame demo (CFI-G).
const GROUP_CARD: Record<Group, string> = { bass: 'bass-ii', saffire: 'saffire-i-iii' };
const DEMO_CARD = 'cfi-g';

/** "About these tests": a link to the investigation's card in the PSI catalogue. */
function CardLink({ links, card, children }: { links: WorkspaceLinks; card: string; children: React.ReactNode }) {
  return (
    <a
      {...linkProps(links.cardHref(card), () => links.showCard(card))}
      data-card-link={card}
      className="text-[11px] underline decoration-dotted underline-offset-2 hover:opacity-80"
      style={{ color: C.amber }}
    >
      {children}
    </a>
  );
}

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
  /** A link asked for a test's preset (id null: no preset has that test id), or for a group. */
  focus?: PresetFocus | null;
  /** Called once the panel has acted on `focus`, so reopening the tab doesn't repeat it. */
  onFocusDone?: () => void;
  /** Links back to the Data Table. */
  links?: WorkspaceLinks;
  /** Load and play the gas flame demo (CFI-G visual demo, not NASA-scored). */
  onLoadDemo?: () => void;
  /** The Moon-base what-if's timeline when it is loaded, else null (see MOON in sandbox.tsx). */
  scenarioStatus?: ScenarioStatus;
}

const MOON_LABEL =
  'extrapolation: not validated above 22.2% O2; pressure is not modelled (the engine runs at 1 atm)';

// The CFI-G visual demo's label (engine project docs/15-gas-flames.md: radiation
// off, hottest cell 3656 K against line 2's calculated flame temperature of 2719 K).
const DEMO_LABEL =
  'visual demo, not NASA-scored. Radiation off; temperatures run above a real flame (peak 3656 K vs 2719 K).';

/** "Show in data table": a real link to ?tab=visualization&test=…, handled in the page on a plain click. */
function TableLink({ links, testId }: { links: WorkspaceLinks; testId: string }) {
  return (
    <a
      href={links.tableHref(testId)}
      data-show-in-table={testId}
      onClick={(e) => {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        links.showInTable(testId);
      }}
      className="text-[11px] underline decoration-dotted underline-offset-2 hover:opacity-80"
      style={{ color: C.amber }}
    >
      Show in data table
    </a>
  );
}

export default function PresetsPanel({
  engine, playing, onLoad, onStop, readingIndex = null, datasetName = null, focus = null, onFocusDone, links, onLoadDemo,
  scenarioStatus,
}: PresetsPanelProps) {
  const scenarioRef = useRef(scenarioStatus);
  scenarioRef.current = scenarioStatus;
  const [f, setF] = useState<FilterState>({ search: '', material: 'all', outcome: 'all', fidelity: 'all' });
  const [selected, setSelected] = useState<number | null>(null);
  // "Details" starts open on a wide screen, closed on a phone (the viewer can toggle it).
  const [detailsOpen, setDetailsOpen] = useState(
    () => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(min-width: 768px)').matches,
  );
  const [lighting, setLighting] = useState<Light>(LIGHT.OPPOSED);
  const [live, setLive] = useState<Live | null>(() => readLive(engine, scenarioStatus));

  // Re-read the engine while the panel is open, so the readout follows the run.
  const refresh = useCallback(() => {
    setLive((prev) => { const next = readLive(engine, scenarioRef.current); return sameLive(prev, next) ? prev : next; });
  }, [engine]);
  useEffect(() => {
    const id = setInterval(refresh, LIVE_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const load = (id: number, play: boolean) => { onLoad(id, lighting, play); refresh(); };
  const stop = () => { onStop?.(); refresh(); };

  // Two groups: the 129 BASS-II presets (ids 0..128) and the 10 Saffire ones (ids 1000+).
  const [group, setGroup] = useState<Group>('bass');
  const bass = useMemo(() => {
    const list: PresetInfo[] = [];
    for (let i = 0; i < engine.presetCount(); i++) list.push(engine.preset(i));
    return list;
  }, [engine]);
  const saffire = useMemo(() => {
    const list: PresetInfo[] = [];
    for (let i = 0; i < engine.saffireCount(); i++) list.push(engine.preset(SAFFIRE_FIRST + i));
    return list;
  }, [engine]);
  const catalogue = useMemo(() => [...bass, ...saffire], [bass, saffire]);
  const groupList = group === 'bass' ? bass : saffire;

  const shown = useMemo(() => groupList.filter((p) => matches(p, f)), [groupList, f]);

  // A link asked for a test's preset (the sandbox has loaded it in standby):
  // clear the filters so its row is listed, select it, and scroll to it.
  const [missingTest, setMissingTest] = useState<string | null>(null);
  const focusNonce = focus?.nonce;
  useEffect(() => {
    if (!focus) return;
    onFocusDone?.();
    if (focus.group) { setMissingTest(null); setGroup(focus.group); setF({ search: '', material: 'all', outcome: 'all', fidelity: 'all' }); return; }
    if (focus.id === null) { setMissingTest(focus.testId); return; }
    const p = catalogue.find((x) => x.id === focus.id);
    if (!p) return;
    setMissingTest(null);
    setGroup(isSaffire(p) ? 'saffire' : 'bass');
    setF({ search: '', material: 'all', outcome: 'all', fidelity: 'all' });
    setSelected(p.id);
    setLighting(p.defaultLighting);
    refresh();
    requestAnimationFrame(() => {
      document.querySelector(`[data-preset-id="${p.id}"]`)?.scrollIntoView({ block: 'nearest' });
    });
    // Only a new request (a new nonce) moves the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

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

  // The selected row's lighting and its Load buttons (always visible, above "Details").
  const actions = (p: PresetInfo) => (
    <>
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
          onClick={() => load(p.id, true)}
          className="rounded-full border bg-amber/15 px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-amber/25"
          style={{ borderColor: C.blue, color: C.fg }}
        >
          Load &amp; Run
        </button>
        <button
          onClick={() => load(p.id, false)}
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
    </>
  );

  // What is loaded and how it is going: pinned to the top of the panel, always visible.
  const liveBlock =
    live?.kind === 'moon' ? (
      <div id="preset-live" data-scenario="moon" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2 text-[12px]">
          <span className="font-medium" style={{ color: C.fg }}>Moon-base what-if</span>
          <StatusLine live={live} playing={playing} />
        </div>
        <div className="space-y-1 text-[11px] leading-5">
          {row('What it is', <span style={{ color: C.amber }}>{MOON_LABEL}</span>)}
          {row('Based on', 'BASS-II B1 (PMMA film 0.1 mm, air 5 cm/s) as NASA ran it; only oxygen → 34% and gravity → 0.17 g')}
          {/* "burned out" reads like "went out": say plainly that the sample was used up. */}
          {row('Our outcome',
            live.outcomeCode === OUTCOME.BURNED_OUT
              ? `the sample was fully consumed by step ${live.outcomeStep}`
              : live.outcomeCode === 0 || live.outcomeStep === 0 ? live.outcomeName : `${live.outcomeName} (step ${live.outcomeStep})`)}
          {row('NASA result', 'none: no test was run at these conditions')}
        </div>
      </div>
    ) : live?.kind === 'demo' ? (
      <div id="preset-live" data-demo="cfig" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2 text-[12px]">
          <span className="font-medium" style={{ color: C.fg }}>Gas flame demo</span>
          <StatusLine live={live} playing={playing} />
        </div>
        <div className="space-y-1 text-[11px] leading-5">
          {row('What it is', 'visual demo, not NASA-scored')}
        </div>
      </div>
    ) : live && livePreset && verdict ? (
      <div id="preset-live" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2 text-[12px]">
          <span className="font-medium" style={{ color: C.fg }}>{livePreset.testId}</span>
          <StatusLine live={live} playing={playing} />
        </div>
        <div className="space-y-1 text-[11px] leading-5">
          {row('Our outcome',
            live.outcomeCode === 0 || live.outcomeStep === 0
              ? live.outcomeName
              : `${live.outcomeName} (step ${live.outcomeStep})`)}
          {row(isSaffire(livePreset) ? 'NASA result' : 'NASA outcome', livePreset.nasaOutcome)}
          {row('Match', (
            <span data-verdict={verdict}>
              <Tag value={verdict} tone={VERDICT_TONE[verdict]} />
              {(isSaffire(livePreset) ? SAFFIRE_NOT_SCORED : VERDICT_NOTE[verdict]) && (
                <span className="mt-0.5 block text-[10px]" style={{ color: C.muted }}>
                  {isSaffire(livePreset) ? SAFFIRE_NOT_SCORED : VERDICT_NOTE[verdict]}
                </span>
              )}
            </span>
          ))}
        </div>
        {links && readingIndex?.has(livePreset.testId) && (
          <div><TableLink links={links} testId={livePreset.testId} /></div>
        )}
      </div>
    ) : (
      <div className="text-[11px]" data-preset-idle style={{ color: C.muted }}>
        <span>Nothing loaded. Select a preset below, then Load &amp; Run.</span>
      </div>
    );

  return (
    <div className={panelCls} style={panelStyle}>
      {/* Pinned: status, our outcome, NASA's, the match. It stays in view while the list scrolls. */}
      <div
        id="preset-pinned"
        className="sticky top-0 z-10 -mx-5 -mt-5 mb-3 rounded-t-[22px] border-b px-5 pt-4 pb-3"
        style={{ background: C.ink2, borderColor: C.line }}
      >
        {liveBlock}
      </div>

      {/* Groups: NASA's BASS-II tests, and the Saffire tests */}
      <div className="mb-2 flex w-fit rounded-full border p-0.5" style={{ borderColor: C.line, background: C.ink }}>
        {([['bass', `BASS-II (${bass.length})`], ['saffire', `Saffire (${saffire.length})`]] as const).map(([g, label]) => {
          const on = group === g;
          return (
            <button
              key={g}
              data-group={g}
              aria-pressed={on}
              onClick={() => { setGroup(g); setF({ ...f, outcome: 'all' }); }}
              className="rounded-full px-3 py-1 text-[11px] transition-colors"
              style={on ? { background: C.line, color: C.fg } : { color: C.muted }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <input
          value={f.search}
          onChange={(e) => setF({ ...f, search: e.target.value })}
          placeholder={`search ${groupList.length} presets`}
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel2 px-3 py-2 text-[12px] leading-5 outline-none focus:border-blue"
          style={{ color: C.fg, background: C.panel2, borderColor: C.line }}
        />
        {select(f.material, 'material', MATERIAL_PICK)}
        {/* NASA gives Saffire tests a burn time, not an outcome code, so no outcome filter there. */}
        {group === 'bass' && select(f.outcome, 'outcome', OUTCOME_PICK)}
        {select(f.fidelity, 'fidelity', FIDELITY_PICK)}
      </div>

      {missingTest && (
        <p className="mt-2 text-[11px]" style={{ color: C.amber }}>
          The link asked for test {missingTest}, which has no preset in the sandbox.
        </p>
      )}

      {/* The honest scorecard: how many NASA-scored tests the engine matches. */}
      {group === 'bass' ? (
        <div id="preset-scorecard" className="mt-2 text-[11px] leading-5" title={SCORECARD_TITLE}>
          <div className="tabular-nums" style={{ color: C.fg }}>
            {scorecard.matched} of {scorecard.scored} scored tests match NASA ({scorecard.matchedTests.join(', ')})
          </div>
          <div className="text-[10px]" style={{ color: C.muted }}>
            scored: NASA&apos;s table says how the test ended ({scorecard.scored} of {scorecard.presets}); the
            other {scorecard.presets - scorecard.scored} can&apos;t be scored.
          </div>
        </div>
      ) : (
        <p id="saffire-note" className="mt-2 text-[11px] leading-5" style={{ color: C.fg }}>
          {SAFFIRE_NOTE}
        </p>
      )}
      {links && (
        <div className="mt-1">
          <CardLink links={links} card={GROUP_CARD[group]}>
            About these tests: {group === 'bass' ? 'BASS-II' : 'Saffire I-III'} in the PSI catalogue
          </CardLink>
        </div>
      )}

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
              const off = cannotLoad(p);
              return (
                <button
                  key={p.id}
                  data-preset-id={p.id}
                  disabled={off}
                  title={off ? p.rule : undefined}
                  onClick={() => { setSelected(p.id); setLighting(p.defaultLighting); }}
                  className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-[11px] transition-colors ${
                    off ? 'cursor-not-allowed opacity-45' : on ? 'bg-line text-fg' : 'text-muted hover:bg-line/50 hover:text-fg'
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
                    <span className="flex items-center gap-1.5 truncate text-[10px] tabular-nums" style={{ color: C.muted }}>
                      <span className="truncate">
                        {p.fidelityName} · {p.shapeName}{isSaffire(p) && !off ? ` · NASA: ${p.nasaOutcome}` : ''}
                      </span>
                      {/* The scorecard tag sits on this second line, so the title keeps its room. */}
                      {SCORECARD.has(p.testId) && (
                        <span className="shrink-0" data-scorecard={SCORECARD.get(p.testId)} title={SCORECARD_TITLE}>
                          <Tag value={SCORECARD.get(p.testId)!} tone={VERDICT_TONE[SCORECARD.get(p.testId)!]} />
                        </span>
                      )}
                    </span>
                  </span>
                  {/* NASA's words can be long ("went out as the flow was lowered"): cap the tag, full text on hover. */}
                  <span className="min-w-0 max-w-[8.5rem] shrink-0 truncate" title={off ? p.rule : isSaffire(p) ? SAFFIRE_NOT_SCORED : p.nasaOutcome}>
                    {off ? <Tag value={/silicone/.test(p.rule) ? 'not modelled: no silicone' : 'not modelled'} /> :
                      isSaffire(p) ? <Tag value="not scored" /> : <Tag value={p.nasaOutcome} tone={tone} />}
                  </span>
                </button>
              );
            })}
          </div>
  
          {/* The selected row: its actions, then its details (folded: "Details") */}
          {activePreset ? (
            <div className="flex flex-col gap-3 border-t pt-3" style={{ borderColor: C.line }}>
              <div className="space-y-1 text-[11px] leading-5">
                {row('Selected', activePreset.testId)}
              </div>
              {actions(activePreset)}
              <details
                id="preset-details"
                open={detailsOpen}
                onToggle={(e) => setDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}
                className="flex flex-col gap-3"
              >
                <summary className="cursor-pointer select-none text-[11px] font-medium" style={{ color: C.fg }}>
                  Details <span className="font-normal" style={{ color: C.muted }}>sample, conditions, rule, NASA readings, flags</span>
                </summary>
              <div className="mt-2 space-y-1 text-[11px] leading-5">
                {row('Sample', `${activePreset.materialName} ${activePreset.kindName}, ${activePreset.shapeName}`)}
                {row('Conditions', `${activePreset.thicknessMm > 0 ? activePreset.thicknessMm.toFixed(2) : '—'} mm · ${activePreset.oxygenPct.toFixed(1)} % O2`)}
                {row('Fidelity', activePreset.fidelityName)}
                {row('Rule', activePreset.rule || '—')}
                {row('Run', `${activePreset.runSteps} steps`)}
              </div>

              {isSaffire(activePreset) && (
                <div className="mt-3 space-y-1 text-[11px] leading-5">
                  {row('NASA result', activePreset.nasaOutcome)}
                  {row('Match', <span style={{ color: C.muted }}>not scored: {SAFFIRE_NOT_SCORED}</span>)}
                </div>
              )}

              {activeReadings && !isSaffire(activePreset) && (
                <div id="preset-readings" data-source={activeReadings.source} className="mt-3 space-y-1 text-[11px] leading-5">
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
                  {links && activeReadings.source === 'dataset' && (
                    <div className="text-right"><TableLink links={links} testId={activePreset.testId} /></div>
                  )}
                </div>
              )}
              </details>
            </div>
          ) : (
            <div className="flex flex-col items-center py-1" style={{ color: C.muted }}>
              <p className="text-sm">No preset selected</p>
              <p className="text-[11px]">Pick a row to load and run it.</p>
            </div>
          )}
        </div>
      )}

      {/* The gas flame demo: one CFI-G burner, shown for the look of a gas flame.
          Not a preset and not scored; Burner stays out of the Build palette. */}
      {onLoadDemo && (
        <div id="cfig-demo" className="mt-3 flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: C.line }}>
          <div>
            <button
              onClick={() => { onLoadDemo(); refresh(); }}
              className="rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-line/50"
              style={{ borderColor: C.line, color: C.fg }}
            >
              Gas flame demo
            </button>
          </div>
          <p className="text-[10px] leading-4" style={{ color: C.muted }}>{DEMO_LABEL}</p>
          <p className="text-[10px] leading-4" style={{ color: C.muted }}>Opens in the Temperature view: the flame is hot gas round the burner.</p>
          {links && <div><CardLink links={links} card={DEMO_CARD}>About CFI-G in the PSI catalogue</CardLink></div>}
        </div>
      )}
    </div>
  );
}
