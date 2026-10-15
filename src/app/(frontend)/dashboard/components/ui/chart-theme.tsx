/**
 * Shared chart/theme tokens for the dashboard panels.
 * Kept in one place so every panel matches the existing dark visual design.
 */
export const C = {
  ink: '#07121c',
  ink2: '#0d1b29',
  panel: '#1c1c24',
  panel2: '#23232c',
  chip: '#2b2b36',
  chip2: '#3a3a47',
  line: '#1d3144',
  fg: '#e7eff6',
  muted: '#90a4b6',
  blue: '#4fa3ff',
  amber: '#ffa64d',
  pink: '#f472b6',
  green: '#34d399',
  violet: '#a78bfa',
  red: '#f87171',
} as const

export const CHART_COLORS = ['#4fa3ff', '#ffa64d', '#34d399', '#f472b6', '#a78bfa', '#fbbf24'] as const

/** Standard panel wrapper matching the existing Card look. */
export const panelCls = 'rounded-[22px] border p-5'
export const panelStyle = { borderColor: C.line, background: C.ink2 } as const

/** Small uppercase section label used across panels. */
export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
    {children}
  </div>
)
