'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { DataRow, DatasetMeta } from '@/lib/types';
import GridCanvas from './view/GridCanvas';
import { Engine, CFIG_VISUAL_DEMO, FIDELITY, LIGHT, PARAM, SAFFIRE_FIRST, loadEngine, type Light } from './engine/Engine';
import { StepClock } from './engine/clock';
import { Tabs, RunBar, ViewBar, ZoomBar, ExposureBar, BuildPanel, WorldPanel, useControls } from './view/Controls';
import type { Exposure } from './view/colors';
import PresetsPanel, { type PresetFocus } from './view/PresetsPanel';
import { fitCell, sampleCentre, type Zoom } from './view/fit';
import { airColourFor } from './view/theme';
import { useActiveTheme } from '../ui/useTheme';
import { buildReadingIndex } from './view/nasaReadings';
import type { WorkspaceLinks } from '../workspace/links';

const SPEEDS = [1, 2, 4, 8] as const;
const TABS = [{ id: 'build', label: 'Build' }, { id: 'world', label: 'World' }, { id: 'presets', label: 'Presets' }];

/** The side panel goes beside the canvas from this pane width (Tailwind @3xl = 48rem). */
const WIDE_PANE_PX = 768;
/** In a narrow pane the canvas may take this share of the pane's height. */
const NARROW_HEIGHT_SHARE = 0.7;

/**
 * The Moon-base what-if, an EXTRAPOLATION: BASS-II test B1 (PMMA film 0.1 mm,
 * air 5 cm/s) as NASA ran it, with only the oxygen raised to 34% (the top of
 * the exploration range) and gravity set to the Moon's 0.17 g. The engine is
 * not validated above 22.2% O2 and does not model pressure (it runs at 1 atm).
 * The preset loads, its timeline stops (the wind stays), the two parameters
 * change and the chamber air is refilled at 34%; it plays for B1's own length.
 */
export const MOON = { testId: 'B1', o2: 0.34, gravity: 0.17 } as const;
type Scenario = { start: number; runSteps: number } | null;

/** The playing timeline: a preset's, the gas flame demo's (stopped at its flow cut), the what-if's, or null. */
function timeline(e: Engine, sc: Scenario): { step: number; runSteps: number; finished: boolean } | null {
  const p = e.presetStatus() ?? e.cfigStatus();
  if (p || !sc) return p;
  const step = e.stepCount - sc.start;
  return { step, runSteps: sc.runSteps, finished: step >= sc.runSteps };
}

interface SandboxProps {
  /** The dashboard's dataset: NASA's readings for each preset come from its row for the same test. */
  dataset?: DatasetMeta;
  rows?: DataRow[];
  /** Links with the Data Table: a request to load a test's preset, and the way back to its row. */
  links?: WorkspaceLinks;
}

export default function Page({ dataset, rows, links }: SandboxProps) {
  const searchParams = useSearchParams()
  const initialView = searchParams.get('view')
  const validViews = ['material', 'temperature', 'oxygen', 'flow', 'co2', 'co', 'camera'] as const
  const initialViewValid = (validViews as readonly string[]).includes(initialView ?? '') ? (initialView as (typeof validViews)[number]) : null
  const [engine, setEngine] = useState<Engine | null>(null);
  const readingIndex = useMemo(
    () => (dataset && rows ? buildReadingIndex(dataset.columns, rows) : null),
    [dataset, rows],
  );
  const [presetPlaying, setPresetPlaying] = useState(false);
  const [behind, setBehind] = useState(false);
  const [cell, setCell] = useState(4);
  // Display zoom, centred on the sample and its fire (its fuel cells and anything
  // over 400 K, found when zoom is picked or a preset loads; it doesn't follow
  // the flame between clicks, so the view stays still).
  const [zoom, setZoomState] = useState<Zoom>(1);
  const [zoomFocus, setZoomFocus] = useState<{ x: number; y: number } | undefined>(undefined);
  const recentre = useCallback(() => {
    if (engine) setZoomFocus(sampleCentre(engine.grid.fuel, engine.width, engine.height, engine.grid.temperature));
  }, [engine]);
  const setZoom = useCallback((z: Zoom) => { recentre(); setZoomState(z); }, [recentre]);
  // Camera view exposure (display only): ×1 is the game's look.
  const [exposure, setExposure] = useState<Exposure>(1);
  const c = useControls();
  // feat/themes: the Material view's air follows the theme (no data colour does).
  const theme = useActiveTheme();
  const airColour = useMemo(() => airColourFor(theme.tokens), [theme]);
  const themeDark = theme.dark;
  const clock = useRef(new StepClock());
  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadEngine().then((e) => { if (!cancelled) setEngine(e); });
    return () => { cancelled = true; };
  }, []);

  // Latest controls for the canvas callbacks, so its loop never sees stale values.
  const cr = useRef(c);
  cr.current = c;
  // A ?view= param (e.g. from the chat's sandbox tool) sets the initial view.
  useEffect(() => {
    if (initialViewValid) cr.current.setView(initialViewValid);
  }, [initialViewValid]);
  const behindRef = useRef(false);

  const scenario = useRef<Scenario>(null);
  useEffect(() => {
    if (!engine) return;
    const id = setInterval(() => {
      const s = timeline(engine, scenario.current);
      setPresetPlaying(!!s && !s.finished);
    }, 200);
    return () => clearInterval(id);
  }, [engine]);

  // Fit the canvas to the space it has, at any window or pane size.
  useEffect(() => {
    if (!engine) return;
    const root = rootRef.current, area = areaRef.current;
    if (!root || !area) return;
    const fit = () => {
      const wide = root.clientWidth >= WIDE_PANE_PX;
      const availW = area.clientWidth;
      const availH = wide ? area.clientHeight : Math.round(root.clientHeight * NARROW_HEIGHT_SHARE);
      setCell(fitCell(availW, availH, engine.width, engine.height, window.devicePixelRatio || 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    ro.observe(area);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [engine]);

  // Steps left in the playing timeline, a preset's or the gas flame demo's
  // (Infinity when none is playing).
  const stepsLeft = useCallback((e: Engine) => {
    const s = timeline(e, scenario.current);
    return s ? Math.max(0, s.runSteps - s.step) : Infinity;
  }, []);

  // The gas flame demo (CFI-G visual demo, not NASA-scored): load and play it,
  // in the Temperature view, because a gas flame is hot gas, not a material
  // (the Material view shows only the burner).
  const loadDemo = useCallback(() => {
    if (!engine) return;
    scenario.current = null;
    engine.cfigLoad(CFIG_VISUAL_DEMO);
    clock.current.reset();
    recentre();
    cr.current.setView('temperature');
    cr.current.setPlaying(true);
  }, [engine, recentre]);

  // Load a preset. "Load & Run" plays it; "Load (standby)" only loads it.
  // Every preset load switches to the Temperature view, where a burning sample
  // shows best (the viewer can still pick any other view).
  const loadPreset = useCallback((id: number, lighting: Light, play: boolean) => {
    if (!engine) return;
    scenario.current = null;
    engine.loadPreset(id, lighting);
    clock.current.reset();
    recentre();
    cr.current.setView('temperature');
    cr.current.setPlaying(play);
  }, [engine, recentre]);

  // The Moon-base what-if (see MOON): B1, then only oxygen and gravity changed.
  const loadMoon = useCallback(() => {
    if (!engine) return;
    let id = -1;
    for (let i = 0; i < engine.presetCount(); i++) if (engine.preset(i).testId === MOON.testId) id = i;
    if (id < 0) return;
    engine.loadPreset(id, LIGHT.DEFAULT);
    engine.stopPreset();
    engine.setParam(PARAM.AMBIENT_OXYGEN, MOON.o2);
    engine.setParam(PARAM.GRAVITY, MOON.gravity);
    engine.refillAir();
    scenario.current = { start: engine.stepCount, runSteps: engine.preset(id).runSteps };
    clock.current.reset();
    recentre();
    cr.current.setView('temperature');
    cr.current.setPlaying(true);
  }, [engine, recentre]);

  const reset = useCallback(() => {
    scenario.current = null;
    engine?.reset();
    setZoomState(1); // an empty chamber: back to the whole view
  }, [engine]);

  // A link from another tab:
  //  - a preset ("Open in sandbox", ?preset=B14): select it in the Presets tab
  //    and load it in standby, with its default lighting;
  //  - a group (?group=saffire, from the PSI catalogue): show that group;
  //  - the gas flame demo (?demo=cfig, from the CFI-G card): play it.
  const [focus, setFocus] = useState<PresetFocus | null>(null);
  const request = links?.sandboxRequest ?? null;
  const requestDone = links?.sandboxRequestDone;
  useEffect(() => {
    if (!engine || !request) return;
    if (request.kind === 'preset') {
      // BASS-II ids 0.., then the Saffire ids SAFFIRE_FIRST..; a NOT MODELLED one can't load.
      const ids = [...Array(engine.presetCount()).keys(), ...[...Array(engine.saffireCount()).keys()].map((k) => SAFFIRE_FIRST + k)];
      let id: number | null = ids.find((i) => engine.preset(i).testId === request.testId) ?? null;
      if (id !== null && engine.preset(id).fidelity === FIDELITY.NOT_MODELLED) id = null;
      if (id !== null) loadPreset(id, engine.preset(id).defaultLighting, false);
      if (initialViewValid) cr.current.setView(initialViewValid);
      setFocus({ id, testId: request.testId, nonce: request.nonce });
    } else if (request.kind === 'group') {
      setFocus({ group: request.group, nonce: request.nonce });
    } else if (request.kind === 'moon') {
      loadMoon();
    } else {
      loadDemo();
    }
    cr.current.setTab('presets');
    requestDone?.();
  }, [engine, request, requestDone, loadPreset, loadDemo, loadMoon]);

  const stopPreset = useCallback(() => {
    engine?.stopPreset();
    cr.current.setPlaying(false);
  }, [engine]);

  // Each frame: run the steps the clock says are due, never past the end of a
  // preset's timeline, and pause exactly when it ends.
  const onFrame = useCallback(() => {
    if (!engine) return;
    const ctl = cr.current;
    if (!ctl.playing) {
      clock.current.reset();
      return;
    }
    const n = clock.current.advance(performance.now(), ctl.speed, stepsLeft(engine));
    if (n > 0) engine.step(n);
    if (behindRef.current !== clock.current.behind) {
      behindRef.current = clock.current.behind;
      setBehind(clock.current.behind);
    }
    if (timeline(engine, scenario.current)?.finished) ctl.setPlaying(false);
  }, [engine, stepsLeft]);

  const onStep = useCallback(() => {
    if (engine && stepsLeft(engine) > 0) engine.step(1);
  }, [engine, stepsLeft]);

  const onStroke = useCallback((x: number, y: number, erase: boolean) => {
    if (!engine) return;
    const { tool, material, fanDir, brushRadius } = cr.current;
    if (erase || tool === 'erase') engine.erase(x, y, brushRadius);
    else if (tool === 'ignite') engine.ignite(x, y, brushRadius);
    else if (engine.materials[material]?.name.toLowerCase() === 'fan') engine.paintFan(x, y, fanDir, brushRadius);
    else engine.paint(x, y, material, brushRadius);
  }, [engine]);

  // Wide pane: canvas column and side panel side by side, both the pane's height.
  // Narrow pane: everything stacked, the canvas at most 70% of the pane's height.
  return (
    <div ref={rootRef} className="@container h-full min-h-0 w-full">
      {engine && (
        <div className="flex w-full flex-col gap-4 @3xl:h-full @3xl:min-h-0 @3xl:flex-row">
          <div className="flex min-w-0 flex-col gap-2 @3xl:min-h-0 @3xl:flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <RunBar
                playing={c.playing} setPlaying={c.setPlaying}
                speed={c.speed} setSpeed={c.setSpeed} speeds={SPEEDS}
                onStep={onStep} onReset={reset}
                behind={behind}
              />
              <ViewBar view={c.view} setView={c.setView} exposure={exposure} />
              {c.view === 'camera' && <ExposureBar exposure={exposure} setExposure={setExposure} />}
              <ZoomBar zoom={zoom} setZoom={setZoom} />
              <Tabs tabs={TABS} active={c.tab} onChange={c.setTab} />
            </div>

            {/* The canvas fits this area and keeps its 4:3 shape. */}
            <div ref={areaRef} className="flex min-w-0 items-start justify-center @3xl:min-h-0 @3xl:flex-1">
              <GridCanvas
                engine={engine}
                view={c.view}
                brushRadius={c.brushRadius}
                onFrame={onFrame}
                onStroke={onStroke}
                cell={cell}
                zoom={zoom}
                focus={zoomFocus}
                exposure={exposure}
                airColour={airColour}
                lightAir={!themeDark}
                className="shrink-0 outline outline-1 outline-line"
              />
            </div>
          </div>

          <aside className="w-full shrink-0 @3xl:w-[380px] @3xl:min-h-0 @3xl:overflow-y-auto">
            <div className="flex flex-col gap-3">
              {c.tab === 'build' && <BuildPanel engine={engine} c={c} />}
              {c.tab === 'world' && <WorldPanel engine={engine} presetPlaying={presetPlaying} />}
              {c.tab === 'presets' && (
                <PresetsPanel
                  engine={engine} playing={c.playing} onLoad={loadPreset} onStop={stopPreset}
                  readingIndex={readingIndex} datasetName={dataset?.name ?? null}
                  focus={focus} onFocusDone={() => setFocus(null)} links={links}
                  onLoadDemo={loadDemo}
                  scenarioStatus={() => (engine && scenario.current ? timeline(engine, scenario.current) : null)}
                />
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
