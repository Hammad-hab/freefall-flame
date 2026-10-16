/**
 * Shared chart/theme tokens for the dashboard panels.
 * Kept in one place so every panel matches the existing dark visual design.
 */
export const C = {
  ink: '#120e08',
  ink2: '#1a140c',
  panel: '#241f1a',
  panel2: '#2c2822',
  chip: '#363026',
  chip2: '#474036',
  line: '#2e2418',
  fg: '#f0ebe2',
  muted: '#a89e90',
  blue: '#ffa64d',
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
