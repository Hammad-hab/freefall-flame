"use client";

import { C, alpha, panelCls, panelStyle } from "../ui/chart-theme";

/* ------------------------------------------------------------------ */
/* Standard panel wrapper                                              */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  subtitle,
  children,
  caveat,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  caveat?: string
}) {
  return (
    <div className={panelCls} style={panelStyle}>
      <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
        {title}
      </h3>
      {subtitle && (
        <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
          {subtitle}
        </p>
      )}
      {children}
      {caveat && (
        <p className="mt-2 text-[10px] leading-4" style={{ color: C.muted }}>
          {caveat}
        </p>
      )}
    </div>
  )
}

/** Amber advisory banner. Used for mapping warnings and excluded readings. */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-3 text-[11px] leading-5"
      style={{ borderColor: alpha(C.amber, 0x55), background: alpha(C.amber, 0x11), color: C.fg }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: C.line, background: C.panel2 }}>
      <div className="text-[11px] uppercase tracking-wider" style={{ color: C.muted }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none tabular-nums" style={{ color: accent ?? C.fg }}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px]" style={{ color: C.muted }}>
          {sub}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Filter pill                                                         */
/* ------------------------------------------------------------------ */

export function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-[11px] transition-colors hover:brightness-110"
      style={{
        borderColor: active ? C.blue : C.line,
        background: active ? C.blue : C.surface,
        color: active ? C.on : C.muted,
      }}
    >
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Chart tooltip                                                       */
/* ------------------------------------------------------------------ */

/** Chart tooltip that always shows the sample size behind a mean. */
export function ChartTooltip({
  active,
  payload,
  label,
  n,
  excluded,
  unit,
}: {
  active?: boolean
  payload?: ReadonlyArray<{
    name?: string | number
    value?: string | number | ReadonlyArray<string | number>
    color?: string
  }>
  label?: string | number
  n?: number
  excluded?: number
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-[11px] shadow-xl"
      style={{ borderColor: C.line, background: C.ink }}
    >
      {label !== undefined && label !== null && (
        <div className="mb-1 font-medium" style={{ color: C.fg }}>
          {String(label)}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? C.fg }}>
          {String(p.name)}:{" "}
          <span className="font-medium tabular-nums">
            {typeof p.value === "number"
              ? p.value.toFixed(2)
              : Array.isArray(p.value)
                ? p.value.join(", ")
                : String(p.value ?? "—")}
            {unit ?? ""}
          </span>
        </div>
      ))}
      {typeof n === "number" && (
        <div className="mt-1 border-t pt-1" style={{ borderColor: C.line, color: C.muted }}>
          n = {n} valid reading{n === 1 ? "" : "s"}
          {typeof excluded === "number" && excluded > 0 && ` · ${excluded} excluded (censored/missing)`}
        </div>
      )}
    </div>
  )
}
