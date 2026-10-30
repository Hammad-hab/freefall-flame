'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GridCanvas from './view/GridCanvas';
import { Engine, loadEngine, type Light } from './engine/Engine';
import { Tabs, RunBar, ViewBar, BuildPanel, WorldPanel, useControls } from './view/Controls';
import PresetsPanel from './view/PresetsPanel';

const SPEEDS = [1, 2, 4, 8] as const;
const TABS = [{ id: 'build', label: 'Build' }, { id: 'world', label: 'World' }, { id: 'presets', label: 'Presets' }];

export default function Page() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [presetPlaying, setPresetPlaying] = useState(false);
  const c = useControls();

  useEffect(() => {
    let cancelled = false;
    loadEngine().then((e) => { if (!cancelled) setEngine(e); });
    return () => { cancelled = true; };
  }, []);

  // Latest controls for the canvas callbacks, so its loop never sees stale values.
  const cr = useRef(c);
  cr.current = c;

  useEffect(() => {
    if (!engine) return;
    const id = setInterval(() => {
      const s = engine.presetStatus();
      setPresetPlaying(!!s && !s.finished);
    }, 200);
    return () => clearInterval(id);
  }, [engine]);

  // Load / stop a preset. Loading starts the timeline; Play/Pause (RunBar +
  // keyboard) drives stepping, so a "Load & Run" also arms playback.
  const loadPreset = useCallback((id: number, lighting: Light) => {
    engine?.loadPreset(id, lighting);
    cr.current.setPlaying(true);
  }, [engine]);

  const stopPreset = useCallback(() => {
    engine?.stopPreset();
    cr.current.setPlaying(false);
  }, [engine]);

  const onFrame = useCallback(() => {
    if (cr.current.playing) engine?.step(cr.current.speed);
  }, [engine]);

  const onStroke = useCallback((x: number, y: number, erase: boolean) => {
    if (!engine) return;
    const { tool, material, fanDir, brushRadius } = cr.current;
    if (erase || tool === 'erase') engine.erase(x, y, brushRadius);
    else if (tool === 'ignite') engine.ignite(x, y, brushRadius);
    else if (engine.materials[material]?.name.toLowerCase() === 'fan') engine.paintFan(x, y, fanDir, brushRadius);
    else engine.paint(x, y, material, brushRadius);
  }, [engine]);

  // Canvas beside the controls. The controls used to be siblings of the canvas in
  // one 4-column grid, so the run bar, legend, tabs and panel each landed in their
  // Container-query variants: the pane can be narrow on a wide screen, so the
  // sidebar drops below the canvas based on the pane's width rather than the
  // viewport's.
  return (
    <div className="@container h-full min-h-0 w-full">
      {engine && (
        <div className="grid h-full min-h-0 w-full grid-cols-3 gap-4">
          {/* Controls bar: run buttons, view buttons and tabs sit above the canvas,
              never crammed into a sidebar column. The bar wraps on narrow screens. */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 col-span-2">
            <RunBar
              playing={c.playing} setPlaying={c.setPlaying}
              speed={c.speed} setSpeed={c.setSpeed} speeds={SPEEDS}
              onStep={() => engine.step()} onReset={() => engine.reset()}
            />
            <ViewBar view={c.view} setView={c.setView} />
            <Tabs tabs={TABS} active={c.tab} onChange={c.setTab} />

            <GridCanvas
              engine={engine}
              view={c.view}
              brushRadius={c.brushRadius}
              onFrame={onFrame}
              onStroke={onStroke}
              className="m-auto shrink-0 rounded-[22px] border border-line"
            />
          </div>
          
          

          {/* Canvas: fixed pixel size, scrolls instead of squeezing */}
          <div className="">
            {/*<div className="flex min-h-0 flex-1 overflow-auto @3xl:min-h-0">
              <GridCanvas
                engine={engine}
                view={c.view}
                brushRadius={c.brushRadius}
                onFrame={onFrame}
                onStroke={onStroke}
                className="m-auto shrink-0 rounded-[22px] border border-line"
              />
            </div>*/}
            <aside className="">
              <div className="flex flex-col gap-3">
                {c.tab === 'build' && <BuildPanel engine={engine} c={c} />}
                {c.tab === 'world' && <WorldPanel engine={engine} presetPlaying={presetPlaying} />}
                {c.tab === 'presets' && (
                  <PresetsPanel engine={engine} onLoad={loadPreset} onStop={stopPreset} />
                )}
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
