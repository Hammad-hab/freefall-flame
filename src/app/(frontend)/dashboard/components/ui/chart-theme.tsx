/** Shared chart/theme tokens for the dashboard panels.
 * Kept in one place so every panel matches the visual design.
 *
 * feat/themes: every value is a CSS variable set by the active theme
 * (ui/themes.ts: Ember on :root, the others on html[data-theme=…]), so all
 * inline styles, SVG charts and panels follow the theme. Ember is today's
 * look. Canvas code can't read var(): it uses useThemeTokens() (ui/useTheme).
 */

export const C = {
  ink: 'var(--c-ink)',
  ink2: 'var(--c-ink2)',
  panel: 'var(--c-panel)',
  panel2: 'var(--c-panel2)',
  chip: 'var(--c-chip)',
  chip2: 'var(--c-chip2)',
  /** Opaque control surfaces. Controls must never be transparent: the animated
   *  background shows through the page padding, so a transparent pill reads as
   *  part of the backdrop instead of as a control. */
  surface: 'var(--c-surface)',
  surfaceHover: 'var(--c-surface-hover)',
  line: 'var(--c-line)',
  fg: 'var(--c-fg)',
  muted: 'var(--c-muted)',
  /** The accent as a fill: active buttons, bars, borders. Text on it uses `on`. */
  accent: 'var(--c-accent)',
  blue: 'var(--c-accent)',
  amber: 'var(--c-accent)',
  on: 'var(--c-on)',
  /** The accent as text: links, highlights, badges (AA on every surface). */
  accentText: 'var(--c-accent-text)',
  pink: 'var(--c-pink)',
  green: 'var(--c-green)',
  violet: 'var(--c-violet)',
  red: 'var(--c-red)',
} as const

export const CHART_COLORS = [1, 2, 3, 4, 5, 6].map((i) => `var(--c-chart-${i})`)

/** A colour at an opacity (0..255, like a hex alpha byte), for theme colours given as var(). */
export function alpha(color: string, a: number): string {
  return `color-mix(in srgb, ${color} ${Math.round((a / 255) * 1000) / 10}%, transparent)`
}

/** Standard panel wrapper matching the existing Card look. */
export const panelCls = 'rounded-[22px] border p-5'
export const panelStyle = { borderColor: C.line, background: C.ink2 } as const

/** Small uppercase section label used across panels. */
export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
    {children}
  </div>
)
