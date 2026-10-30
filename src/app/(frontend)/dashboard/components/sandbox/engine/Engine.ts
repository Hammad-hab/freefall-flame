// engine.ts - a thin TypeScript wrapper around the flame-core WebAssembly
// module. Every method is one or two fc_* calls; read it as a guide to the
// C API (include/flame_core.h) from TypeScript.
//
// Works in a browser and in Node.js; it touches no DOM.
//
// Three things to know about calling WebAssembly from JavaScript:
//  1. Every C function is exported with a leading underscore: fc_step is
//     fc._fc_step.
//  2. Strings come back as POINTERS (numbers); read them with
//     fc.UTF8ToString(ptr).
//  3. uint32_t results come back as signed numbers; `x >>> 0` makes them
//     unsigned again (checksums, step counts, colours).

import createFlameCore from './flame_core.mjs';

// The Emscripten module: every exported C function is `_fc_*` taking and
// returning numbers (ints, floats, pointers).
export type FcFn = (...args: number[]) => number;
export interface FlameCoreModule {
  HEAPF32: Float32Array;
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  UTF8ToString(ptr: number): string;
  [fn: `_fc_${string}`]: FcFn;
}

type Values<T> = T[keyof T];

// Mirrors of the C enums in flame_core.h. (C enums don't exist at run time,
// so a TypeScript caller copies the numbers.)
export const MAT = Object.freeze({
  AIR: 0, WOOD: 1, WOOD_FIRE: 2, CHAR: 3, WALL: 4, SAND: 5, WATER: 6, STEAM: 7, STONE: 8,
  ICE: 9, OIL: 10, OIL_FIRE: 11, SMOKE: 12, FLAME: 13, FAN: 14, PMMA: 15, PMMA_FIRE: 16,
  SIBAL: 17, SIBAL_FIRE: 18, FIBREGLASS: 19, NOMEX: 20, NOMEX_FIRE: 21, WAX: 22,
  WAX_LIQUID: 23, WAX_FIRE: 24,
} as const);
export const KIND = Object.freeze({ STATIC: 0, POWDER: 1, LIQUID: 2, GAS: 3 } as const);
export const DIR = Object.freeze({ RIGHT: 0, DOWN: 1, LEFT: 2, UP: 3 } as const);
export const PARAM = Object.freeze({
  GRAVITY: 0, HEAT_RATE: 1, AMBIENT_OXYGEN: 2, FLOW: 3, WIND: 4, RADIATION: 5, FAN_SPEED: 6,
} as const);
export const LOG = Object.freeze({
  O2_PCT: 0, CO2_PCT: 1, CO_PPM: 2, BURNING: 3, PEAK_K: 4, RADIATED: 5, AIR_CM_S: 6,
  O2_USED: 7, CO2_MADE: 8, CO_MADE: 9, FIELD_COUNT: 10,
} as const);
export const OUTCOME = Object.freeze({
  NONE: 0, BURNING: 1, NO_LASTING_FLAME: 2, BURNED_OUT: 3, BLOWN_OFF: 4, OUT_LOW_FLOW: 5,
  OUT_STEADY_FLOW: 6,
} as const);
export const FIDELITY = Object.freeze({ FULL: 0, PARTIAL: 1, NOT_MODELLED: 2 } as const);
export const NASA = Object.freeze({
  NOT_STATED: 0, WENT_OUT_LOW_FLOW: 1, BLOWOFF: 2, NO_IGNITION: 3, NOT_SUSTAINED: 4,
} as const);
export const READING = Object.freeze({
  O2_BEFORE_PCT: 0, O2_AFTER_PCT: 1, CO2_BEFORE_PCT: 2, CO2_AFTER_PCT: 3,
  CO_BEFORE_PPM: 4, CO_AFTER_PPM: 5, CO2_PER_O2: 6, COUNT: 7,
} as const);
export const LIGHT = Object.freeze({ DEFAULT: 0, OPPOSED: 1, CONCURRENT: 2 } as const);
export const NO_READING = -1;          // FC_NO_READING
export const WIND_PER_CM_S = 0.012;    // FC_WIND_PER_CM_S: the working scale, not physics

export type Mat = Values<typeof MAT>;
export type Kind = Values<typeof KIND>;
export type Dir = Values<typeof DIR>;
export type Param = Values<typeof PARAM>;
export type Light = Values<typeof LIGHT>;

// The summary fields, in enum fc_summary_field order, as object keys.
const SUMMARY_KEYS = [
  'step', 'burningCells', 'flameCells', 'extentX0', 'extentY0', 'extentX1', 'extentY1',
  'peakTempK', 'fuelLeft', 'oxygenUsed', 'co2Made', 'coMade', 'radiatedHeat',
  'ventOxygenIn', 'ventOxygenOut', 'ventCo2Out', 'ventCoOut',
] as const;

export type Summary = Record<(typeof SUMMARY_KEYS)[number], number>;

export interface MaterialInfo {
  id: number;
  name: string;
  r: number; g: number; b: number;
  kind: number;
  burning: boolean;
}

export interface Grid {
  material: Uint8Array;
  temperature: Float32Array;
  oxygen: Float32Array;
  co2: Float32Array;
  co: Float32Array;
  fuel: Float32Array;
  fanDir: Uint8Array;
  flowX: Float32Array;   // across each cell's right face, + = right
  flowY: Float32Array;   // across each cell's bottom face, + = down
}

export interface ParamInfo { name: string; unit: string; min: number; max: number; def: number }
export interface EngineEvent { type: number; name: string; step: number }
export interface Outcome { code: number; name: string; step: number }

export interface DataLog {
  count: number;
  every: number;
  steps: Uint32Array;
  values: Float32Array;
  fieldName: (f: number) => string;
}

export interface PresetSegment { steps: number; from: number; to: number }

export interface PresetInfo {
  id: number;
  testId: string;
  summary: string;
  fidelity: number; fidelityName: string;
  rule: string;
  kind: number; kindName: string;
  shape: number; shapeName: string;
  material: number; materialName: string;
  thicknessMm: number;
  oxygenPct: number;
  nasaOutcome: string;
  nasaCode: number;
  readings: number[];
  segments: PresetSegment[];
  runSteps: number;
  lighting: Record<number, string>;
  defaultLighting: Light;
}

export interface PresetStatus {
  id: number;
  step: number;
  finished: boolean;
  lighting: number;
  airCmS: number;
}

// Load the module and create the engine. Each call gives a separate,
// independent world (one engine per WebAssembly instance).
export async function loadEngine(): Promise<Engine> {
  const fc = (await createFlameCore()) as FlameCoreModule;
  return new Engine(fc);
}

export class Engine {
  readonly fc: FlameCoreModule;
  readonly width: number;
  readonly height: number;
  readonly cells: number;
  readonly grid: Grid;
  readonly materials: MaterialInfo[] = [];

  constructor(fc: FlameCoreModule) {
    this.fc = fc;
    console.log(Object.keys(fc).filter(k => k.startsWith('_')));
    
    fc._fc_create();                       // default parameters, empty chamber
    this.width = fc._fc_width();
    this.height = fc._fc_height();
    this.cells = this.width * this.height;

    // Typed-array VIEWS on the engine's memory: no copying, always current.
    // The pointers never change and the memory never grows, so these stay
    // valid for the life of the page.
    const f32 = (ptr: number) => new Float32Array(fc.HEAPF32.buffer, ptr, this.cells);
    const u8 = (ptr: number) => new Uint8Array(fc.HEAPU8.buffer, ptr, this.cells);
    this.grid = {
      material: u8(fc._fc_grid_material()),
      temperature: f32(fc._fc_grid_temperature()),
      oxygen: f32(fc._fc_grid_oxygen()),
      co2: f32(fc._fc_grid_co2()),
      co: f32(fc._fc_grid_co()),
      fuel: f32(fc._fc_grid_fuel()),
      fanDir: u8(fc._fc_grid_fan_dir()),
      flowX: f32(fc._fc_grid_flow_x()),
      flowY: f32(fc._fc_grid_flow_y()),
    };

    // The material table never changes: read it once.
    for (let m = 0; m < fc._fc_material_count(); m++) {
      const rgb = fc._fc_material_color(m) >>> 0;   // 0xRRGGBB
      this.materials.push({
        id: m,
        name: this.str(fc._fc_material_name(m)),
        r: (rgb >> 16) & 255, g: (rgb >> 8) & 255, b: rgb & 255,
        kind: fc._fc_material_kind(m),
        burning: fc._fc_material_burning(m) === 1,
      });
    }
  }

  str(ptr: number): string { return this.fc.UTF8ToString(ptr); }

  // ---- Lifecycle -----------------------------------------------------------
  reset(): void { this.fc._fc_reset(); }                  // empty chamber, parameters kept
  step(n = 1): void { this.fc._fc_step(n); }              // a playing preset sets the wind each step
  get stepCount(): number { return this.fc._fc_step_count() >>> 0; }
  checksum(): number { return this.fc._fc_checksum() >>> 0; }

  // ---- Parameters ----------------------------------------------------------
  setParam(p: Param, value: number): number { return this.fc._fc_set_param(p, value); } // clamped to the range
  getParam(p: Param): number { return this.fc._fc_get_param(p); }
  paramInfo(p: Param): ParamInfo {
    const fc = this.fc;
    return {
      name: this.str(fc._fc_param_name(p)), unit: this.str(fc._fc_param_unit(p)),
      min: fc._fc_param_min(p), max: fc._fc_param_max(p), def: fc._fc_param_default(p),
    };
  }

  // ---- Editing (radius 0 = one cell; each returns cells changed) ------------
  paint(x: number, y: number, material: number, radius: number): number { return this.fc._fc_paint(x, y, material, radius); }
  paintFan(x: number, y: number, dir: Dir, radius: number): number { return this.fc._fc_paint_fan(x, y, dir, radius); }
  erase(x: number, y: number, radius: number): number { return this.fc._fc_erase(x, y, radius); }
  ignite(x: number, y: number, radius: number): number { return this.fc._fc_ignite(x, y, radius); }   // +700 K, starts the verdict
  addHeat(x: number, y: number, kelvin: number, radius: number): number { return this.fc._fc_add_heat(x, y, kelvin, radius); }
  refillAir(): void { this.fc._fc_refill_air(); }

  // ---- Live summary, events, outcome ----------------------------------------
  summary(): Summary {
    const out = {} as Summary;
    SUMMARY_KEYS.forEach((key, field) => { out[key] = this.fc._fc_summary_value(field); });
    return out;
  }

  events(): EngineEvent[] {
    const fc = this.fc, list: EngineEvent[] = [];
    for (let k = 0; k < fc._fc_event_count(); k++) {
      const type = fc._fc_event_type(k);
      list.push({ type, name: this.str(fc._fc_event_name(type)), step: fc._fc_event_step(k) >>> 0 });
    }
    return list;
  }

  outcome(): Outcome {
    const code = this.fc._fc_outcome();
    return { code, name: this.str(this.fc._fc_outcome_name(code)), step: this.fc._fc_outcome_step() >>> 0 };
  }

  // ---- Data log ----------------------------------------------------------------
  // Fresh views each call: the count changes as samples are added.
  log(): DataLog {
    const fc = this.fc, count = fc._fc_log_count();
    return {
      count,
      every: fc._fc_log_every() >>> 0,
      steps: new Uint32Array(fc.HEAPU32.buffer, fc._fc_log_steps(), count),
      values: new Float32Array(fc.HEAPF32.buffer, fc._fc_log_values(), count * LOG.FIELD_COUNT),
      fieldName: (f: number) => this.str(fc._fc_log_field_name(f)),
    };
  }

  // ---- Camera view: 0..1 per cell, recomputed by each call -------------------
  camera(): Float32Array {
    return new Float32Array(this.fc.HEAPF32.buffer, this.fc._fc_camera_intensity(), this.cells);
  }

  // ---- Presets ---------------------------------------------------------------------
  presetCount(): number { return this.fc._fc_preset_count(); }

  // Everything a preset says about itself, as one object.
  preset(id: number): PresetInfo {
    const fc = this.fc, s = (ptr: number) => this.str(ptr);
    const segments: PresetSegment[] = [];
    for (let k = 0; k < fc._fc_preset_segment_count(id); k++) {
      segments.push({
        steps: fc._fc_preset_segment_steps(id, k),
        from: fc._fc_preset_segment_air_from(id, k),
        to: fc._fc_preset_segment_air_to(id, k),
      });
    }
    const readings: number[] = [];
    for (let r = 0; r < READING.COUNT; r++) readings.push(fc._fc_preset_nasa_reading(id, r));
    const fidelity = fc._fc_preset_fidelity(id), kind = fc._fc_preset_kind(id);
    const shape = fc._fc_preset_shape(id), material = fc._fc_preset_material(id);
    const lighting: Record<number, string> = {
      [LIGHT.DEFAULT]: s(fc._fc_preset_lighting_as(id, LIGHT.DEFAULT)),
      [LIGHT.OPPOSED]: s(fc._fc_preset_lighting_as(id, LIGHT.OPPOSED)),
      [LIGHT.CONCURRENT]: s(fc._fc_preset_lighting_as(id, LIGHT.CONCURRENT)),
    };
    return {
      id,
      testId: s(fc._fc_preset_test_id(id)),
      summary: s(fc._fc_preset_summary(id)),
      fidelity, fidelityName: s(fc._fc_fidelity_name(fidelity)),
      rule: s(fc._fc_preset_rule(id)),                    // the fidelity note
      kind, kindName: s(fc._fc_sample_kind_name(kind)),
      shape, shapeName: s(fc._fc_shape_name(shape)),
      material, materialName: material >= 0 ? this.materials[material].name : '',
      thicknessMm: fc._fc_preset_thickness_mm(id),
      oxygenPct: fc._fc_preset_oxygen_pct(id),
      nasaOutcome: s(fc._fc_preset_nasa_outcome(id)),
      nasaCode: fc._fc_preset_nasa_code(id),
      readings,
      segments,
      runSteps: fc._fc_preset_run_steps(id),
      lighting,
      // The default is concurrent only for the sphere sections.
      defaultLighting: lighting[LIGHT.DEFAULT] === lighting[LIGHT.CONCURRENT] ? LIGHT.CONCURRENT : LIGHT.OPPOSED,
    };
  }

  // Load and start playing. lighting: LIGHT.OPPOSED or LIGHT.CONCURRENT
  // (or LIGHT.DEFAULT). Returns false if refused.
  loadPreset(id: number, lighting: Light = LIGHT.DEFAULT): boolean { return this.fc._fc_preset_load_lit(id, lighting) === 0; }
  stopPreset(): void { this.fc._fc_preset_stop(); }        // keeps the world; stops the timeline

  // What is playing now, or null.
  presetStatus(): PresetStatus | null {
    const fc = this.fc, id = fc._fc_preset_active();
    if (id < 0) return null;
    const step = fc._fc_preset_step();
    return {
      id, step,
      finished: fc._fc_preset_finished() === 1,
      lighting: fc._fc_preset_active_lighting(),
      airCmS: fc._fc_preset_air_at(id, step),
    };
  }

  // ---- Snapshot -----------------------------------------------------------------------
  snapshot<T = unknown>(): T { return JSON.parse(this.str(this.fc._fc_snapshot_json())) as T; }
}