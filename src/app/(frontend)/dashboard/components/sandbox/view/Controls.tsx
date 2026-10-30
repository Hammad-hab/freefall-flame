'use client';

// Controls.tsx - tabs, run bar, view buttons + legend, Build tab, World tab.
// Parameters are always read back from the engine (single source of truth:
// it clamps, and a playing preset changes the wind every step).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Engine, MAT, PARAM, DIR, WIND_PER_CM_S, type Dir, type Param } from '../engine/Engine';
import { VIEWS, SCALES, sample, type View } from './colors';
import { C, panelCls, panelStyle } from '../../ui/chart-theme';

export const TOOLS = ['paint', 'erase', 'ignite'] as const;
export type Tool = (typeof TOOLS)[number];

const VIEW_LABELS: Record<View, string> = {
  material: 'Material', temperature: 'Temperature', oxygen: 'Oxygen', co2: 'CO2', flow: 'Flow', camera: 'Camera',
};
const GRAVITY_PRESETS: [string, number][] = [['Earth', 1], ['Mars', 0.38], ['Moon', 0.165], ['Zero', 0]];
const FAN_DIRS: [string, Dir][] = [['Right', DIR.RIGHT], ['Down', DIR.DOWN], ['Left', DIR.LEFT], ['Up', DIR.UP]];

const fmt = (v: number, digits: number) => v.toFixed(digits);

/* ---------------------------------------------------------------------------
 * Control styling.
 *
 * Follows the vocabulary the rest of the dashboard already uses (see
 * ui/chart-theme.ts and the evidence/* panels): amber marks the active or
 * primary control, C.surface is the idle chip, C.panel2 is an inset row, and
 * labels sit at 11-12px. Kept as constants so the five exports below cannot
 * drift apart.
 * ------------------------------------------------------------------------- */

/** Toggle / action pill. */
const pill =
  'rounded-full border px-3 py-1.5 text-[11px] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40';

/** Idle vs active pill. Amber-on-ink is the dashboard's active state. */
const pillState = (on: boolean) => ({
  borderColor: on ? C.blue : C.line,
  background: on ? C.blue : C.surface,
  color: on ? C.ink : C.muted,
});

/** The one primary action per group (Play/Pause). */
const primary = { borderColor: C.blue, background: C.blue, color: C.ink };

/** Inset row holding a slider or a select. */
const rowCls = 'rounded-xl border p-3';
const rowStyle = { borderColor: C.line, background: C.panel2 };

const labelCls = 'text-[12px]';

/** Value readout. tabular-nums keeps it from jittering as the number changes. */
const badgeCls = 'inline-block rounded-full px-2 py-0.5 text-[11px] tabular-nums';
const badgeStyle = { background: C.chip2, color: C.blue };

const selectCls = 'rounded-lg border px-2 py-1 text-[11px]';
const selectStyle = { borderColor: C.line, background: C.surface, color: C.fg };

// accent-flame-amber is the @theme token; the native range track picks it up.
const rangeCls = 'mt-2 w-full accent-flame-amber disabled:opacity-40';

// ---- UI state that isn't in the engine --------------------------------------
export function useControls(initialTab = 'build') {
  const [playing, setPlaying] = useState(true);
  const [tool, setTool] = useState<Tool>('paint');
  const [material, setMaterial] = useState<number>(MAT.WOOD);
  const [fanDir, setFanDir] = useState<Dir>(DIR.RIGHT);
  const [tab, setTab] = useState(initialTab);
  const [view, setView] = useState<View>('material');
  const [brushRadius, setBrushRadius] = useState(2);
  const [speed, setSpeed] = useState(1);
  return {
    playing, setPlaying, tool, setTool, material, setMaterial, fanDir, setFanDir,
    tab, setTab, view, setView, brushRadius, setBrushRadius, speed, setSpeed,
  };
}
export type Controls = ReturnType<typeof useControls>;

// ---- Tabs ---------------------------------------------------------------------
export function Tabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void;
}) {
  // Segmented control, matching the Columns/Dataset switcher in overview/SummaryChart.
  return (
    <div
      className="flex shrink-0 rounded-full border p-0.5"
      style={{ borderColor: C.line, background: C.ink }}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="flex-1 rounded-full px-4 py-1.5 text-[11px] transition-colors"
            style={{ background: on ? C.chip : 'transparent', color: on ? C.fg : C.muted }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Run bar --------------------------------------------------------------------
export function RunBar({ playing, setPlaying, speed, setSpeed, speeds, onStep, onReset }: {
  playing: boolean; setPlaying: (p: boolean) => void;
  speed: number; setSpeed: (s: number) => void; speeds: readonly number[];
  onStep: () => void; onReset: () => void;
}) {
  const step = useCallback(() => { setPlaying(false); onStep(); }, [setPlaying, onStep]);

  useEffect(() => {                                           // the desktop's keys
    const onKey = (e: KeyboardEvent) => {
      // Not while typing, and not on a focused button: Space would also click it.
      if ((e.target as HTMLElement).matches('input, select, textarea, button')) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
      else if (e.key === 'n' || e.key === 'N') step();
      else if (e.key === 'c' || e.key === 'C') onReset();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [playing, setPlaying, step, onReset]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={() => setPlaying(!playing)} className={pill} style={primary}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <button onClick={step} className={pill} style={pillState(false)}>Step</button>
      <button onClick={onReset} className={pill} style={pillState(false)}>Reset</button>
      {/* Speed is a setting rather than an action, so it sits apart at the end. */}
      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className={`${selectCls} ml-auto`}
        style={selectStyle}
      >
        {speeds.map((s) => <option key={s} value={s}>{s}x</option>)}
      </select>
    </div>
  );
}

// ---- Views + legend ---------------------------------------------------------------
export function ViewBar({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div id="view-bar" className="flex min-w-0 flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <button key={v} className={pill} style={pillState(v === view)} onClick={() => setView(v)}>
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
      <Legend view={view} />
    </div>
  );
}

// A colour ramp under the canvas for every view but Material.
function Legend({ view }: { view: View }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = view === 'material' ? undefined : SCALES[view];

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx || !scale) return;
    const { stops } = scale, lo = stops[0][0], hi = stops[stops.length - 1][0];
    for (let i = 0; i < 260; i++) {
      const [r, g, b] = sample(stops, lo + ((hi - lo) * i) / 259);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(i, 0, 1, 1);
    }
  }, [scale]);

  if (!scale) return <div id="legend" />;
  const lo = scale.stops[0][0], hi = scale.stops[scale.stops.length - 1][0];
  return (
    <div id="legend" className="flex items-center gap-2 text-[10px] tabular-nums" style={{ color: C.muted }}>
      <span>{lo}</span>
      {/* The ramp is drawn 260x1; CSS stretches that single row into a readable band. */}
      <canvas ref={ref} width={260} height={1} className="h-2 min-w-0 flex-1 rounded-full" />
      <span>{hi}</span>
      <span className="whitespace-nowrap">{scale.unit}</span>
    </div>
  );
}

// ---- Build tab -----------------------------------------------------------------------
export function BuildPanel({ engine, c }: { engine: Engine; c: Controls }) {
  const { tool, setTool, material, setMaterial, fanDir, setFanDir, brushRadius, setBrushRadius } = c;
  const selectMaterial = (id: number) => { setMaterial(id); setTool('paint'); };
  const showFan = material === MAT.FAN && tool === 'paint';

  return (
    <div className={panelCls} style={panelStyle}>
      <div id="tools" className="flex flex-wrap gap-1.5">
        {TOOLS.map((t) => (
          <button key={t} className={pill} style={pillState(t === tool)} onClick={() => setTool(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* <label> may only contain phrasing content, so the layout wrappers here are
          spans with display:flex rather than divs — that keeps the implicit
          label/control association without invalid markup. */}
      <label className={`${rowCls} mt-3 block`} style={rowStyle}>
        <span className="flex items-baseline justify-between gap-2">
          <span className={labelCls} style={{ color: C.fg }}>Brush</span>
          <output className={badgeCls} style={badgeStyle}>{brushRadius}</output>
        </span>
        <input type="range" min={0} max={8} step={1} value={brushRadius}
          onChange={(e) => setBrushRadius(Number(e.target.value))} className={rangeCls} />
      </label>

      {showFan && (
        <label className={`${rowCls} mt-3 block`} style={rowStyle}>
          <span className="flex items-center justify-between gap-2">
            <span className={labelCls} style={{ color: C.fg }}>Fan direction</span>
            <select value={fanDir} onChange={(e) => setFanDir(Number(e.target.value) as Dir)}
              className={selectCls} style={selectStyle}>
              {FAN_DIRS.map(([name, d]) => <option key={d} value={d}>{name}</option>)}
            </select>
          </span>
        </label>
      )}

      {/* 25 materials: two columns, each name truncated rather than wrapped so the
          grid rows stay aligned. The swatch carries the colour, so the selected
          state is an amber border instead of the usual amber fill. */}
      <div id="palette" className="mt-3 grid grid-cols-2 gap-1.5">
        {engine.materials.map((m) => {
          const on = m.id === material && tool === 'paint';
          return (
            <button
              key={m.id}
              onClick={() => selectMaterial(m.id)}
              className="flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] transition-colors hover:brightness-110"
              style={{
                borderColor: on ? C.blue : C.line,
                background: on ? C.chip2 : C.surface,
                color: on ? C.fg : C.muted,
              }}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-[3px] border"
                style={{ background: `rgb(${m.r},${m.g},${m.b})`, borderColor: 'rgba(255,255,255,0.18)' }}
              />
              <span className="truncate">{m.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- World tab ------------------------------------------------------------------------
// Reads the value back from the engine on an interval so preset-driven
// changes (and clamping) show up.
function useEngineParam(engine: Engine, param: Param, intervalMs = 100) {
  const [value, setValue] = useState(() => engine.getParam(param));
  useEffect(() => {
    const id = setInterval(() => setValue(engine.getParam(param)), intervalMs);
    return () => clearInterval(id);
  }, [engine, param, intervalMs]);
  const set = useCallback((v: number) => {
    engine.setParam(param, v);
    setValue(engine.getParam(param));                         // show the clamped value
  }, [engine, param]);
  return [value, set] as const;
}

function ParamSlider({ engine, param, label, show, disabled = false, note }: {
  engine: Engine; param: Param; label: string; show: (v: number) => string;
  disabled?: boolean; note?: string;
}) {
  const info = useMemo(() => engine.paramInfo(param), [engine, param]);  // fc_param_min / max
  const [value, set] = useEngineParam(engine, param);
  return (
    <label className={`${rowCls} block`} style={rowStyle}>
      <span className="flex items-baseline justify-between gap-2">
        <span className={labelCls} style={{ color: C.fg }}>{label}</span>
        <output className={badgeCls} style={badgeStyle}>{show(value)}</output>
      </span>
      <input type="range" min={info.min} max={info.max} step="any" value={value} disabled={disabled}
        onChange={(e) => set(Number(e.target.value))} className={rangeCls} />
      {note && <span className="mt-1 block text-[10px] leading-4" style={{ color: C.muted }}>{note}</span>}
    </label>
  );
}

export function WorldPanel({ engine, presetPlaying }: { engine: Engine; presetPlaying: boolean }) {
  return (
    <div className={`${panelCls} space-y-3`} style={panelStyle}>
      <ParamSlider engine={engine} param={PARAM.GRAVITY} label="Gravity" show={(v) => `${fmt(v, 3)} g`} />
      <div id="gravity-presets" className="grid grid-cols-2 gap-1.5">
        {GRAVITY_PRESETS.map(([name, g]) => (
          <button key={name} className={pill} style={pillState(false)} onClick={() => engine.setParam(PARAM.GRAVITY, g)}>
            {name} ({g} g)
          </button>
        ))}
      </div>
      <ParamSlider engine={engine} param={PARAM.AMBIENT_OXYGEN} label="Oxygen" show={(v) => `${fmt(100 * v, 1)} %`} />
      <ParamSlider engine={engine} param={PARAM.WIND} label="Wind" disabled={presetPlaying}
        note={presetPlaying ? "(set by the preset's timeline)" : ''}
        show={(v) => `${fmt(v, 3)} = ${fmt(v / WIND_PER_CM_S, 1)} cm/s`} />
      <ParamSlider engine={engine} param={PARAM.FAN_SPEED} label="Fan" show={(v) => `${fmt(v, 3)} c/s/s`} />
      <button onClick={() => engine.refillAir()} className={pill} style={pillState(false)}>Refill air</button>
    </div>
  );
}
