'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GridCanvas from './view/GridCanvas';
import { Engine, loadEngine, type Light } from './engine/Engine';
import { StepClock } from './engine/clock';
import { Tabs, RunBar, ViewBar, BuildPanel, WorldPanel, useControls } from './view/Controls';
import PresetsPanel from './view/PresetsPanel';
import { fitCell } from './view/fit';
import { AIR_COLOUR } from './view/theme';

const SPEEDS = [1, 2, 4, 8] as const;
const TABS = [{ id: 'build', label: 'Build' }, { id: 'world', label: 'World' }, { id: 'presets', label: 'Presets' }];

/** The side panel goes beside the canvas from this pane width (Tailwind @3xl = 48rem). */
const WIDE_PANE_PX = 768;
/** In a narrow pane the canvas may take this share of the pane's height. */
const NARROW_HEIGHT_SHARE = 0.7;

export default function Page() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [presetPlaying, setPresetPlaying] = useState(false);
  const [behind, setBehind] = useState(false);
  const [cell, setCell] = useState(4);
  const c = useControls();
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
  const behindRef = useRef(false);

  useEffect(() => {
    if (!engine) return;
    const id = setInterval(() => {
      const s = engine.presetStatus();
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

  // Steps left in the playing preset's timeline (Infinity when none is playing).
  const stepsLeft = useCallback((e: Engine) => {
    const s = e.presetStatus();
    return s ? Math.max(0, s.runSteps - s.step) : Infinity;
  }, []);

  // Load a preset. "Load & Run" plays it; "Load (standby)" only loads it.
  const loadPreset = useCallback((id: number, lighting: Light, play: boolean) => {
    if (!engine) return;
    engine.loadPreset(id, lighting);
    clock.current.reset();
    cr.current.setPlaying(play);
  }, [engine]);

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
    const s = engine.presetStatus();
    if (s?.finished) ctl.setPlaying(false);
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
                onStep={onStep} onReset={() => engine.reset()}
                behind={behind}
              />
              <ViewBar view={c.view} setView={c.setView} />
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
                airColour={AIR_COLOUR}
                className="shrink-0 outline outline-1 outline-line"
              />
            </div>
          </div>

          <aside className="w-full shrink-0 @3xl:w-[380px] @3xl:min-h-0 @3xl:overflow-y-auto">
            <div className="flex flex-col gap-3">
              {c.tab === 'build' && <BuildPanel engine={engine} c={c} />}
              {c.tab === 'world' && <WorldPanel engine={engine} presetPlaying={presetPlaying} />}
              {c.tab === 'presets' && (
                <PresetsPanel engine={engine} playing={c.playing} onLoad={loadPreset} onStop={stopPreset} />
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
