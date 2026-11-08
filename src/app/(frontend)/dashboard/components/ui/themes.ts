/**
 * The dashboard's colour themes (feat/themes). No DOM and no React here: the
 * frontend layout turns them into CSS (themeCss) and a tiny boot script
 * (THEME_BOOT) that applies the saved theme before the first paint.
 *
 * - 20 themes from "Flame in Freefall: theme options": 8 Flame in Freefall
 *   themes, then 12 Jupyter ones. Ember is today's dashboard (chart-theme C)
 *   exactly, and the default.
 * - Each theme gives the file's 10 tokens; the rest are derived. Then every
 *   text colour must reach WCAG AA (4.5:1) on every surface it sits on, and
 *   chart colours 3:1. A colour that falls short is moved toward white (dark
 *   themes) or black (light themes) in 1% steps, stopping at the first step
 *   that passes (fixToward), so the look changes as little as possible.
 * - The sandbox's data colours (view/colors.ts) are not here: they show
 *   values and are the same in every theme.
 */

export type Hex = `#${string}`

/** The file's 10 tokens, plus (Ember only) the in-between surfaces today's dashboard has. */
export interface RawTheme {
  ink: Hex; panel: Hex; panel2: Hex; surface: Hex; line: Hex; fg: Hex; muted: Hex; accent: Hex; on: Hex; chip2: Hex
  ink2?: Hex; ink3?: Hex; chip?: Hex; surfaceHover?: Hex
}

export interface ThemeDef { id: string; name: string; group: 'Flame in Freefall' | 'Jupyter'; description: string; raw: RawTheme }

export const THEME_DEFS: ThemeDef[] = [
  // Today's dashboard: chart-theme.ts C and global.css, value for value.
  { id: 'ember', name: 'Ember', group: 'Flame in Freefall', description: 'Current. Warm dark, amber accent. Best fit for fire.',
    raw: { ink: '#120e08', ink2: '#1a140c', ink3: '#1f1a14', panel: '#241f1a', panel2: '#2c2822', chip: '#363026', chip2: '#474036', surface: '#363026', surfaceHover: '#474036', line: '#2e2418', fg: '#f0ebe2', muted: '#a89e90', accent: '#ffa64d', on: '#1a0f05' } },
  { id: 'midnight', name: 'Midnight', group: 'Flame in Freefall', description: 'Cool blue-black. Makes flame colours pop in the grid.',
    raw: { ink: '#0b0f17', panel: '#121826', panel2: '#1a2233', surface: '#202a3d', line: '#2c384f', fg: '#e8eef9', muted: '#8d9bb5', accent: '#5aa9f4', on: '#06101d', chip2: '#1f3050' } },
  { id: 'forest', name: 'Forest', group: 'Flame in Freefall', description: 'Deep green, lime accent. Calm for long sessions.',
    raw: { ink: '#0b120e', panel: '#111b15', panel2: '#18261d', surface: '#1e2f24', line: '#2a4132', fg: '#e8f4ec', muted: '#8fa898', accent: '#8fe08a', on: '#08140b', chip2: '#223c2a' } },
  { id: 'violet', name: 'Violet', group: 'Flame in Freefall', description: 'Plum dark, soft violet. Reads as research tool.',
    raw: { ink: '#100c16', panel: '#181222', panel2: '#221a30', surface: '#2a2039', line: '#3a2d4f', fg: '#f0eaf8', muted: '#a698bd', accent: '#b48cf4', on: '#150b24', chip2: '#33264c' } },
  { id: 'rose', name: 'Rose', group: 'Flame in Freefall', description: 'Wine dark, coral-pink accent. Warmer than Ember, less orange.',
    raw: { ink: '#140c0e', panel: '#1e1316', panel2: '#2a1b1f', surface: '#332126', line: '#46303a', fg: '#f8ecee', muted: '#b49aa0', accent: '#f4728a', on: '#240810', chip2: '#47252d' } },
  { id: 'graphite', name: 'Graphite', group: 'Flame in Freefall', description: 'Neutral grey, white accent. Lets the sim be the only colour.',
    raw: { ink: '#0e0e0f', panel: '#161617', panel2: '#202022', surface: '#28282b', line: '#37373b', fg: '#f2f2f3', muted: '#9b9ba1', accent: '#e6e6ea', on: '#111113', chip2: '#34343a' } },
  { id: 'paper', name: 'Paper', group: 'Flame in Freefall', description: 'Light warm paper, burnt orange. For print and projector.',
    raw: { ink: '#f6f1e9', panel: '#fffaf2', panel2: '#f2ebdf', surface: '#ebe3d4', line: '#d9cfbd', fg: '#231a10', muted: '#7b6c57', accent: '#d9622b', on: '#fff7ee', chip2: '#f6dcc9' } },
  { id: 'daylight', name: 'Daylight', group: 'Flame in Freefall', description: 'Cool light grey-blue. Clean, high contrast.',
    raw: { ink: '#eef2f7', panel: '#ffffff', panel2: '#f1f4f9', surface: '#e6ebf3', line: '#d3dae6', fg: '#0f1a2b', muted: '#5d6b82', accent: '#1f6fe0', on: '#ffffff', chip2: '#dbe8fb' } },
  { id: 'lab-light', name: 'Lab Light', group: 'Jupyter', description: 'JupyterLab default light.',
    raw: { ink: '#eeeeee', panel: '#ffffff', panel2: '#f5f5f5', surface: '#eeeeee', line: '#bdbdbd', fg: '#212121', muted: '#616161', accent: '#1976d2', on: '#ffffff', chip2: '#d6e6f7' } },
  { id: 'lab-dark', name: 'Lab Dark', group: 'Jupyter', description: 'JupyterLab default dark.',
    raw: { ink: '#111111', panel: '#1e1e1e', panel2: '#262626', surface: '#2f2f2f', line: '#424242', fg: '#eeeeee', muted: '#9e9e9e', accent: '#2196f3', on: '#04111f', chip2: '#1b3a5c' } },
  { id: 'dracula', name: 'Dracula', group: 'Jupyter', description: 'Purple on charcoal.',
    raw: { ink: '#21222c', panel: '#282a36', panel2: '#303341', surface: '#383a4a', line: '#44475a', fg: '#f8f8f2', muted: '#7d88b8', accent: '#bd93f9', on: '#1d1630', chip2: '#3d3a5c' } },
  { id: 'monokai', name: 'Monokai', group: 'Jupyter', description: 'Classic editor dark, lime accent.',
    raw: { ink: '#1e1f1c', panel: '#272822', panel2: '#2f302a', surface: '#3a3b33', line: '#49483e', fg: '#f8f8f2', muted: '#9a9680', accent: '#a6e22e', on: '#12190a', chip2: '#3b4224' } },
  { id: 'solarized-dark', name: 'Solarized Dark', group: 'Jupyter', description: 'Low-contrast teal dark.',
    raw: { ink: '#00212b', panel: '#002b36', panel2: '#073642', surface: '#0c4150', line: '#1b5565', fg: '#eee8d5', muted: '#93a1a1', accent: '#268bd2', on: '#fdf6e3', chip2: '#0e4a63' } },
  { id: 'solarized-light', name: 'Solarized Light', group: 'Jupyter', description: 'Cream light with blue accent.',
    raw: { ink: '#eee8d5', panel: '#fdf6e3', panel2: '#f5eed9', surface: '#eee8d5', line: '#d6cfb8', fg: '#073642', muted: '#657b83', accent: '#268bd2', on: '#fdf6e3', chip2: '#d5e6ea' } },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark', group: 'Jupyter', description: 'Retro warm dark, yellow accent.',
    raw: { ink: '#1d2021', panel: '#282828', panel2: '#32302f', surface: '#3c3836', line: '#504945', fg: '#ebdbb2', muted: '#a89984', accent: '#fabd2f', on: '#1d2021', chip2: '#4a3f1e' } },
  { id: 'gruvbox-light', name: 'Gruvbox Light', group: 'Jupyter', description: 'Retro warm light, rust accent.',
    raw: { ink: '#f2e5bc', panel: '#fbf1c7', panel2: '#f2e5bc', surface: '#ebdbb2', line: '#d5c4a1', fg: '#3c3836', muted: '#7c6f64', accent: '#af3a03', on: '#fbf1c7', chip2: '#f1d3b4' } },
  { id: 'nord', name: 'Nord', group: 'Jupyter', description: 'Arctic blue-grey.',
    raw: { ink: '#242933', panel: '#2e3440', panel2: '#3b4252', surface: '#434c5e', line: '#4c566a', fg: '#eceff4', muted: '#a3adc2', accent: '#88c0d0', on: '#1c2530', chip2: '#3b5361' } },
  { id: 'one-dark', name: 'One Dark', group: 'Jupyter', description: 'Atom-style dark, blue accent.',
    raw: { ink: '#1b1d23', panel: '#21252b', panel2: '#282c34', surface: '#2f343d', line: '#3e4451', fg: '#c8ccd4', muted: '#7f8795', accent: '#61afef', on: '#0d1520', chip2: '#28405c' } },
  { id: 'oceans16', name: 'Oceans16', group: 'Jupyter', description: 'Muted slate, sea-glass accent.',
    raw: { ink: '#232832', panel: '#2b303b', panel2: '#343d46', surface: '#3b4550', line: '#4f5b66', fg: '#dfe1e8', muted: '#a7adba', accent: '#96b5b4', on: '#17201f', chip2: '#35484a' } },
  { id: 'chesterish', name: 'Chesterish', group: 'Jupyter', description: 'jupyter-themes dark, orange accent.',
    raw: { ink: '#1c1f24', panel: '#22252b', panel2: '#2a2e36', surface: '#323741', line: '#424855', fg: '#e0e2e6', muted: '#9097a3', accent: '#ff9d4d', on: '#1c0f04', chip2: '#4a3220' } },
]

export const DEFAULT_THEME = 'ember'

// Today's fixed (theme-free) colours: status hues and the six chart series.
export const STATUS_BASE = { green: '#34d399', red: '#f87171', pink: '#f472b6', violet: '#a78bfa', info: '#4fa3ff', fixing: '#5fd3a5' } as const satisfies Record<string, Hex>
export const CHART_BASE = ['#4fa3ff', '#ffa64d', '#34d399', '#f472b6', '#a78bfa', '#fbbf24'] as const satisfies readonly Hex[]

// ---- Colour arithmetic (sRGB, WCAG 2 relative luminance) ----

const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
export function hexToRgb(h: string): [number, number, number] { return [ch(h, 0), ch(h, 1), ch(h, 2)] }
export function luminance(h: string): number {
  const [r, g, b] = hexToRgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** a blended toward b by t (0..1), rounded to whole channel values. */
export function mix(a: string, b: string, t: number): Hex {
  return ('#' + [0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('')) as Hex
}
/**
 * The first of c, c 1% toward `toward`, 2%, ... that reaches `target` against
 * every colour in `bgs`; with the number of steps (0 = unchanged).
 */
export function fixToward(c: Hex, bgs: readonly string[], target: number, toward: '#ffffff' | '#000000'): { hex: Hex; steps: number } {
  for (let s = 0; s <= 100; s++) {
    const x = s === 0 ? c : mix(c, toward, s / 100)
    if (bgs.every((b) => contrast(x, b) >= target)) return { hex: x, steps: s }
  }
  return { hex: toward, steps: 100 }
}

// ---- Tokens ----

export const TEXT_AA = 4.5
export const GRAPHIC_AA = 3

export interface Tokens {
  ink: Hex; ink2: Hex; ink3: Hex; panel: Hex; panel2: Hex; chip: Hex; chip2: Hex; surface: Hex; surfaceHover: Hex; line: Hex
  fg: Hex; muted: Hex
  /** Accent as a fill (active buttons, bars, borders), with `on` as the text on it. */
  accent: Hex; on: Hex
  /** Accent as text (links, highlights, badges). */
  accentText: Hex
  green: Hex; red: Hex; pink: Hex; violet: Hex; info: Hex; fixing: Hex
  chart: Hex[]
}

export interface Theme extends ThemeDef { dark: boolean; tokens: Tokens; fixes: { token: string; from: Hex; to: Hex; steps: number }[] }

/** Every surface text sits on: the page, panels, cards, inset rows, chips. */
export const textBackgrounds = (t: Tokens) => [t.ink, t.ink2, t.ink3, t.panel, t.panel2, t.surface, t.chip2]
/** Where chart marks and status words sit: panels and inset rows. */
export const markBackgrounds = (t: Tokens) => [t.ink2, t.panel, t.panel2]

export function deriveTheme(def: ThemeDef): Theme {
  const r = def.raw
  const dark = luminance(r.ink) < 0.4
  const away = dark ? '#ffffff' : '#000000'
  const fixes: Theme['fixes'] = []
  const fix = (token: string, c: Hex, bgs: readonly string[], target: number, toward: '#ffffff' | '#000000' = away) => {
    const f = fixToward(c, bgs, target, toward)
    if (f.steps > 0) fixes.push({ token, from: c, to: f.hex, steps: f.steps })
    return f.hex
  }
  const t = {
    ink: r.ink, ink2: r.ink2 ?? mix(r.ink, r.panel, 0.5), ink3: r.ink3 ?? mix(r.ink, r.panel, 0.75),
    panel: r.panel, panel2: r.panel2, chip: r.chip ?? r.surface, chip2: r.chip2, surface: r.surface,
    surfaceHover: r.surfaceHover ?? r.chip2, line: r.line, on: r.on,
  } as Tokens
  const bgs = textBackgrounds(t), marks = markBackgrounds(t)
  t.fg = fix('fg', r.fg, bgs, TEXT_AA)
  t.muted = fix('muted', r.muted, bgs, TEXT_AA)
  t.accentText = fix('accentText', r.accent, bgs, TEXT_AA)
  // The fill moves away from its text colour `on` until the label reads, and
  // must also stand out from the panels as a graphic (charts draw bars in it).
  // When no fill can do both with the theme's `on` (Solarized Dark: light text
  // on the fill, dark panels), `on` becomes the theme's ink and the fill is
  // fixed against that instead.
  const fillFor = (on: Hex, dry: boolean) => {
    const toward = luminance(on) < luminance(r.accent) ? '#ffffff' : '#000000'
    const a = fixToward(r.accent, [on], TEXT_AA, toward)
    const g = marks.some((b) => contrast(a.hex, b) < GRAPHIC_AA) ? fixToward(a.hex, marks, GRAPHIC_AA, away) : { hex: a.hex, steps: 0 }
    const ok = contrast(on, g.hex) >= TEXT_AA
    if (!dry && ok) {
      if (a.steps) fixes.push({ token: 'accent', from: r.accent, to: a.hex, steps: a.steps })
      if (g.steps) fixes.push({ token: 'accent (graphic)', from: a.hex, to: g.hex, steps: g.steps })
    }
    return ok ? g.hex : null
  }
  const keep = fillFor(r.on, true)
  if (keep !== null) t.accent = fillFor(r.on, false) as Hex
  else {
    t.on = r.ink
    fixes.push({ token: 'on', from: r.on, to: r.ink, steps: 0 })
    t.accent = fillFor(r.ink, false) ?? r.accent
  }
  for (const k of Object.keys(STATUS_BASE) as (keyof typeof STATUS_BASE)[]) t[k] = fix(k, STATUS_BASE[k], marks, TEXT_AA)
  t.chart = CHART_BASE.map((c, i) => fix(`chart${i + 1}`, c, marks, GRAPHIC_AA))
  return { ...def, dark, tokens: t, fixes }
}

export const THEMES: Theme[] = THEME_DEFS.map(deriveTheme)
export const themeById = (id: string | null | undefined): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0]

// ---- CSS ----

/** CSS custom property per token (chart-theme.ts C reads these). */
export function themeVars(t: Tokens): Record<string, string> {
  const v: Record<string, string> = {
    '--c-ink': t.ink, '--c-ink2': t.ink2, '--c-ink3': t.ink3, '--c-panel': t.panel, '--c-panel2': t.panel2,
    '--c-chip': t.chip, '--c-chip2': t.chip2, '--c-surface': t.surface, '--c-surface-hover': t.surfaceHover, '--c-line': t.line,
    '--c-fg': t.fg, '--c-muted': t.muted, '--c-accent': t.accent, '--c-accent-text': t.accentText, '--c-on': t.on,
    '--c-green': t.green, '--c-red': t.red, '--c-pink': t.pink, '--c-violet': t.violet, '--c-info': t.info, '--c-fixing': t.fixing,
  }
  t.chart.forEach((c, i) => { v[`--c-chart-${i + 1}`] = c })
  return v
}

const block = (sel: string, th: Theme) =>
  `${sel}{color-scheme:${th.dark ? 'dark' : 'light'};${Object.entries(themeVars(th.tokens)).map(([k, v]) => `${k}:${v}`).join(';')}}`

/** Ember on :root, every other theme on html[data-theme=id]. */
export function themeCss(): string {
  return [block(':root', THEMES[0]), ...THEMES.slice(1).map((th) => block(`:root[data-theme=${th.id}]`, th))].join('\n')
}

// ---- Saving (localStorage, never required) ----

export const STORAGE_KEY = 'flame-theme'

/** The saved theme's id, or Ember when there is none, it is unknown, or storage is blocked. */
export function loadThemeId(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): string {
  try {
    const v = storage?.getItem(STORAGE_KEY)
    return THEMES.some((t) => t.id === v) ? (v as string) : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function saveThemeId(id: string, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try { storage?.setItem(STORAGE_KEY, id) } catch { /* the page works without it */ }
}

/**
 * Runs in <head> before the first paint: puts the saved theme on <html>.
 * Static text built from the theme ids only, never from user data.
 */
export const THEME_BOOT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(${JSON.stringify(THEMES.slice(1).map((t) => t.id))}.indexOf(v)>=0)document.documentElement.setAttribute('data-theme',v)}catch(e){}})()`
