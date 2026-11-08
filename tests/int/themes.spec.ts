/**
 * feat/themes: the dashboard's 20 themes (ui/themes.ts), from "Flame in
 * Freefall: theme options". Ember is today's look; every text colour reaches
 * WCAG AA (4.5:1) on every surface it sits on, chart colours 3:1; each fix is
 * the smallest 1% step that passes; the choice is saved without needing
 * storage; the sandbox's data colours never depend on the theme.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  THEMES, THEME_DEFS, DEFAULT_THEME, STORAGE_KEY, THEME_BOOT, CHART_BASE, STATUS_BASE, TEXT_AA, GRAPHIC_AA,
  contrast, mix, fixToward, textBackgrounds, markBackgrounds, themeCss, themeById, loadThemeId, saveThemeId,
} from '@/app/(frontend)/dashboard/components/ui/themes'
import { fillView, type ColorEngine, VIEWS } from '@/app/(frontend)/dashboard/components/sandbox/view/colors'
import { KIND } from '@/app/(frontend)/dashboard/components/sandbox/engine/Engine'

afterEach(() => document.documentElement.removeAttribute('data-theme'))

describe('themes', () => {
  it('has the 20 themes in the file order under one heading, Freefall Labs, Ember first and default', () => {
    expect(THEMES.map((t) => t.name)).toEqual([
      'Ember', 'Midnight', 'Forest', 'Violet', 'Rose', 'Graphite', 'Paper', 'Daylight',
      'Lab Light', 'Lab Dark', 'Dracula', 'Monokai', 'Solarized Dark', 'Solarized Light', 'Gruvbox Dark', 'Gruvbox Light',
      'Nord', 'One Dark', 'Oceans16', 'Chesterish',
    ])
    expect(THEMES.every((t) => t.group === 'Freefall Labs')).toBe(true)
    // No theme description mentions Jupyter or JupyterLab.
    expect(THEMES.filter((t) => /jupyter/i.test(t.description)).map((t) => t.name)).toEqual([])
    expect(THEMES.every((t) => t.description.length > 5)).toBe(true)
    expect(DEFAULT_THEME).toBe('ember')
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(20)
    expect(THEMES.filter((t) => !t.dark).map((t) => t.id)).toEqual(['paper', 'daylight', 'lab-light', 'solarized-light', 'gruvbox-light'])
  })

  it('Ember is today\'s dashboard, except muted, lifted 14% so it passes on chip2 too', () => {
    const e = themeById('ember').tokens
    expect(e).toMatchObject({
      ink: '#120e08', ink2: '#1a140c', ink3: '#1f1a14', panel: '#241f1a', panel2: '#2c2822', chip: '#363026', chip2: '#474036',
      surface: '#363026', surfaceHover: '#474036', line: '#2e2418', fg: '#f0ebe2', accent: '#ffa64d', accentText: '#ffa64d', on: '#1a0f05',
      green: '#34d399', red: '#f87171', pink: '#f472b6', violet: '#a78bfa', info: '#4fa3ff', fixing: '#5fd3a5',
    })
    expect(e.chart).toEqual([...CHART_BASE])
    expect(contrast('#a89e90', '#474036')).toBeLessThan(4.5) // today's pair: 3.87
    expect(themeById('ember').fixes).toEqual([{ token: 'muted', from: '#a89e90', to: '#b4aca0', steps: 14 }])
    expect(e.muted).toBe('#b4aca0')
  })

  it('every text colour reaches 4.5:1 on every surface, every chart and accent fill 3:1, in every theme', () => {
    for (const th of THEMES) {
      const t = th.tokens
      for (const bg of textBackgrounds(t)) {
        for (const k of ['fg', 'muted', 'accentText'] as const) expect(contrast(t[k], bg), `${th.name} ${k} on ${bg}`).toBeGreaterThanOrEqual(TEXT_AA)
      }
      expect(contrast(t.on, t.accent), `${th.name} on/accent`).toBeGreaterThanOrEqual(TEXT_AA)
      for (const bg of markBackgrounds(t)) {
        for (const k of Object.keys(STATUS_BASE) as (keyof typeof STATUS_BASE)[]) expect(contrast(t[k], bg), `${th.name} ${k}`).toBeGreaterThanOrEqual(TEXT_AA)
        t.chart.forEach((c, i) => expect(contrast(c, bg), `${th.name} chart${i + 1}`).toBeGreaterThanOrEqual(GRAPHIC_AA))
        expect(contrast(t.accent, bg), `${th.name} accent fill`).toBeGreaterThanOrEqual(GRAPHIC_AA)
      }
    }
  })

  it('each fix is the smallest step: one step less still fails, and unfixed colours are the file\'s', () => {
    for (const th of THEMES) {
      for (const f of th.fixes) {
        // `on` is swapped for the theme's ink (0 steps) only when no accent fill works with it.
        if (f.token === 'on') expect([f.steps, f.to]).toEqual([0, th.raw.ink])
        else expect(f.steps).toBeGreaterThan(0)
        expect(f.to).not.toBe(f.from)
      }
      const t = th.tokens, raw = th.raw, bgs = textBackgrounds(t)
      for (const [k, c] of [['fg', raw.fg], ['muted', raw.muted], ['accentText', raw.accent]] as const) {
        const f = th.fixes.find((x) => x.token === k)
        if (!f) { expect(t[k]).toBe(c); continue }
        const toward = th.dark ? '#ffffff' : '#000000'
        expect(fixToward(c, bgs, TEXT_AA, toward)).toEqual({ hex: t[k], steps: f.steps })
        expect(bgs.some((b) => contrast(mix(c, toward, (f.steps - 1) / 100), b) < TEXT_AA)).toBe(true)
      }
      expect(t.ink).toBe(raw.ink); expect(t.panel).toBe(raw.panel); expect(t.line).toBe(raw.line)
      expect(t.on).toBe(th.fixes.some((f) => f.token === 'on') ? raw.ink : raw.on)
    }
    // Only Solarized Dark needs the swap: light text on its accent can't also stand out on its dark panels.
    expect(THEMES.filter((th) => th.fixes.some((f) => f.token === 'on')).map((th) => th.id)).toEqual(['solarized-dark'])
    // The six themes the design listed as passing (Graphite gets one 1% step on chip2).
    for (const id of ['midnight', 'forest', 'violet', 'rose']) expect(themeById(id).fixes).toEqual([])
  })

  it('writes Ember on :root and every other theme on html[data-theme=id], with light or dark controls', () => {
    const css = themeCss()
    expect(css.startsWith(':root{color-scheme:dark;--c-ink:#120e08;')).toBe(true)
    for (const th of THEMES.slice(1)) expect(css).toContain(`:root[data-theme=${th.id}]{color-scheme:${th.dark ? 'dark' : 'light'};`)
    expect(css).not.toMatch(/[<>&"']/) // plain text inside <style>
    expect(css.match(/--c-chart-6:/g)).toHaveLength(20)
  })

  it('loads the saved theme, or Ember when there is none, it is unknown, or storage throws; saving never throws', () => {
    const store = (v: string | null) => ({ getItem: () => v })
    expect(loadThemeId(store('daylight'))).toBe('daylight')
    expect(loadThemeId(store(null))).toBe('ember')
    expect(loadThemeId(store('no-such-theme'))).toBe('ember')
    expect(loadThemeId({ getItem: () => { throw new Error('blocked') } })).toBe('ember')
    expect(loadThemeId(undefined)).toBe('ember')
    const saved: Record<string, string> = {}
    saveThemeId('nord', { setItem: (k, v) => { saved[k] = v } })
    expect(saved).toEqual({ [STORAGE_KEY]: 'nord' })
    expect(() => saveThemeId('nord', { setItem: () => { throw new Error('quota') } })).not.toThrow()
  })

  it('the boot script sets a saved non-default theme on <html>, and nothing for Ember, unknown or blocked storage', () => {
    const run = (v: string | null, throws = false) => {
      document.documentElement.removeAttribute('data-theme')
      const ls = { getItem: () => { if (throws) throw new Error('blocked'); return v } }
      new Function('localStorage', THEME_BOOT)(ls)
      return document.documentElement.getAttribute('data-theme')
    }
    expect(run('midnight')).toBe('midnight')
    expect(run('ember')).toBe(null)
    expect(run('<script>')).toBe(null)
    expect(run('daylight', true)).toBe(null)
  })

  it('the sandbox data views draw the same pixels whatever theme is on the page', () => {
    const n = 4, z = () => new Float32Array(n)
    const w: ColorEngine = {
      grid: { material: Uint8Array.from([0, 0, 1, 0]), temperature: Float32Array.from([300, 900, 300, 1500]), oxygen: Float32Array.from([0.21, 0.1, 0, 0.3]), co2: Float32Array.from([0, 0.05, 0, 0.2]), co: Float32Array.from([0, 0.002, 0, 0.01]), fuel: Float32Array.from([0, 0, 1, 0]), flowX: Float32Array.from([0.1, 0.2, 0, 0.4]), flowY: z() },
      materials: [{ kind: KIND.GAS, r: 20, g: 20, b: 30 }, { kind: KIND.STATIC, r: 200, g: 100, b: 50 }],
      width: n, cells: n, camera: () => Float32Array.from([0, 0.3, 0.1, 0.9]),
    }
    const draw = () => VIEWS.filter((v) => v !== 'material').map((v) => { const px = new Uint8ClampedArray(n * 4); fillView(w, v, px); return [...px] })
    const ember = draw()
    for (const th of THEMES.slice(1)) {
      document.documentElement.setAttribute('data-theme', th.id)
      expect(draw(), th.name).toEqual(ember)
    }
    expect(THEME_DEFS).toHaveLength(20)
  })
})
