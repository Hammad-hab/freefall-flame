'use client'
/**
 * feat/themes: the Customize tab. The 20 themes as buttons with their colour
 * dots, grouped as in "Flame in Freefall: theme options"; a click changes
 * the whole dashboard at once (the other panes are the live preview) and is
 * saved in this browser. A small sample shows the theme's parts, and a strip
 * of the Temperature scale shows that data colours never change.
 */
import { C, CHART_COLORS, panelCls, panelStyle, SectionLabel } from '../ui/chart-theme'
import { THEMES, DEFAULT_THEME, themeById } from '../ui/themes'
import { useThemeId } from '../ui/useTheme'
import { SCALES } from '../sandbox/view/colors'

const GROUPS = ['Freefall Labs'] as const

// Plain words for the tokens a theme's contrast fixes touched (ui/themes.ts).
const FIX_WORDS: Record<string, string> = {
  fg: 'text', muted: 'muted text', accentText: 'accent text', accent: 'accent fill', on: 'text on the accent',
  green: 'status colours', red: 'status colours', pink: 'status colours', violet: 'status colours', info: 'status colours', fixing: 'status colours',
  chart: 'chart colours',
}

// The Temperature view's scale as a CSS gradient (fixed: it shows values).
const TEMP = SCALES.temperature.stops
const TEMP_GRADIENT = `linear-gradient(90deg, ${TEMP.map(([v, [r, g, b]]) => `rgb(${r},${g},${b}) ${(100 * v) / TEMP[TEMP.length - 1][0]}%`).join(', ')})`

export default function Customize() {
  const [id, setId] = useThemeId()
  const active = themeById(id)

  return (
    <div id="customize" className="space-y-4" data-active-theme={active.id}>
      <section className={panelCls} style={panelStyle} aria-labelledby="customize-theme-h">
        <h2 id="customize-theme-h" className="text-[16px] font-medium" style={{ color: C.fg }}>Theme</h2>
        <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
          Pick one and the whole dashboard changes as you click. Saved in this browser; the first visit gets Ember.
        </p>
        {GROUPS.map((group) => (
          <div key={group} className="mt-4">
            <SectionLabel>{group}</SectionLabel>
            <div role="group" aria-label={`${group} themes`} className="flex flex-wrap gap-2">
              {THEMES.filter((t) => t.group === group).map((t) => {
                const on = t.id === active.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-theme-id={t.id}
                    aria-pressed={on}
                    title={t.description}
                    onClick={() => setId(t.id)}
                    className="flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-3 text-[12px] transition-colors"
                    style={{ borderColor: on ? C.accent : C.line, background: C.surface, color: on ? C.fg : C.muted }}
                  >
                    {/* The theme's own page, inset and accent colours. */}
                    <span className="flex" aria-hidden>
                      {[t.raw.ink, t.raw.panel2, t.raw.accent].map((c, i) => (
                        <i key={i} className="block h-3 w-3 rounded-full border" style={{ background: c, borderColor: 'rgba(128,128,128,0.4)', marginLeft: i ? -3 : 0 }} />
                      ))}
                    </span>
                    {t.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <p id="theme-description" className="mt-4 text-[12px]" style={{ color: C.fg }}>
          <span className="font-medium">{active.name}</span>
          <span style={{ color: C.muted }}> · {active.description}</span>
        </p>
        {active.fixes.length > 0 && (
          <p id="theme-fixes" className="mt-1 text-[11px]" style={{ color: C.muted }}>
            Adjusted for readability (WCAG AA): {[...new Set(active.fixes.map((f) => FIX_WORDS[f.token.replace(/ \(graphic\)$/, '').replace(/^chart\d$/, 'chart')] ?? f.token))].join(', ')}.
          </p>
        )}
        {active.id !== DEFAULT_THEME && (
          <button type="button" onClick={() => setId(DEFAULT_THEME)} className="mt-3 rounded-full border px-3 py-1.5 text-[11px]" style={{ borderColor: C.line, background: C.surface, color: C.muted }}>
            Back to Ember
          </button>
        )}
      </section>

      <section id="customize-preview" className={panelCls} style={panelStyle} aria-label="Theme sample">
        <SectionLabel>Sample</SectionLabel>
        <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border px-3 py-2 text-[12px]" style={{ borderColor: C.line, background: C.panel2, color: C.fg }}>
              <span>Tests</span>
              <span className="rounded-full px-2 py-0.5 text-[11px] tabular-nums" style={{ background: C.chip2, color: C.accentText }}>129</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: C.accent, background: C.accent, color: C.on }}>Pause</span>
              <span className="rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: C.line, background: C.surface, color: C.muted }}>Step</span>
              <span className="rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: C.line, background: C.surface, color: C.muted }}>Reset</span>
            </div>
            <p className="text-[12px]" style={{ color: C.muted }}>
              Muted text, and <span style={{ color: C.accentText }}>a link</span>.
            </p>
          </div>
          <div className="rounded-xl p-3 text-[12px]" style={{ background: C.accent, color: C.on }}>
            <div className="text-[22px] font-light leading-none tabular-nums">4 of 26</div>
            <div className="mt-1">scored tests match NASA</div>
          </div>
          <div>
            <div className="flex h-16 items-end gap-1.5" aria-hidden>
              {CHART_COLORS.map((c, i) => (
                <span key={i} className="block flex-1 rounded-t" style={{ background: c, height: `${40 + ((i * 37) % 60)}%` }} />
              ))}
            </div>
            <div className="mt-1 flex gap-3 text-[11px]">
              <span style={{ color: C.green }}>match</span>
              <span style={{ color: C.red }}>no match</span>
              <span style={{ color: C.muted }}>not scored</span>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div id="customize-data-scale" className="h-2 rounded-full" style={{ background: TEMP_GRADIENT }} />
          <p className="mt-1 text-[11px]" style={{ color: C.muted }}>
            Data colours never change: the sandbox&apos;s Temperature, Oxygen, CO2, CO, Flow and Camera scales, the material
            colours and the faint fuel are the same in every theme. Only empty air and the canvas frame follow it.
          </p>
        </div>
      </section>
    </div>
  )
}
