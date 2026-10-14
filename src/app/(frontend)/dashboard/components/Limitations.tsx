"use client"

import { C, panelCls, panelStyle } from "./chart-theme"

/**
 * Scope and Limitations — the scientific guardrails for the whole dashboard.
 * Rendered on every analysis tab so the boundaries of the evidence are always
 * visible without overwhelming the layout.
 */
export default function Limitations() {
  return (
    <div className={panelCls} style={panelStyle}>
      <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
        Scope and Limitations
      </h3>
      <p className="mt-2 text-[12px] leading-5" style={{ color: C.fg }}>
        The BASS-II measurements represented in this dashboard were collected under International
        Space Station microgravity conditions. They do not directly establish how these materials
        will behave under lunar gravity, Martian gravity, or other habitat environments. Results
        should not be interpreted as direct predictions of fire risk or combustion outcomes in
        Moon or Mars missions.
      </p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[12px] leading-5" style={{ color: C.muted }}>
        <li>
          Descriptive gas measurements are not the same as fire outcomes. Gas concentration changes
          alone do not establish ignition probability, flame spread, crew exposure, or overall
          fire risk.
        </li>
        <li>
          Results depend on the tested materials, sample sizes, oxygen conditions, airflow,
          experimental procedures, and measurement limitations.
        </li>
        <li>
          Untested material–oxygen combinations represent evidence gaps, not proof of safety or
          unsafety.
        </li>
        <li>
          Excluded censored measurements (for example out-of-range sensor readings) may bias
          summary statistics low.
        </li>
        <li>
          Evidence scores rank how much the dataset tells us about a material. They are not fire-risk
          scores or safety ratings.
        </li>
      </ul>
    </div>
  )
}
