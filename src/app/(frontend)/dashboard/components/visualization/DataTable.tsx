"use client";

/**
 * Data table — the raw readings behind the charts.
 *
 * Censored and out-of-range sensor readings are shown as amber markers carrying
 * their original source text (e.g. ">500") instead of being hidden or replaced
 * with a blank, so a reader can see exactly what the source sheet said.
 */
import type { ColumnResolution, ParsedRow, ReadingClass } from "@/lib/combustion";
import type { DataRow, DatasetMeta } from "@/lib/types";
import { C, panelCls, panelStyle } from "../ui/chart-theme";

const READING_LABEL: Record<ReadingClass, string> = {
  valid: "valid",
  missing: "missing",
  censored: "censored",
  outOfRange: "out of range",
  invalid: "invalid",
};

type TableColumn = { key: string; label: string };

export function DataTable({
  filtered,
  rows,
  resolutions,
}: {
  filtered: ParsedRow[];
  rows: DataRow[];
  resolutions: Record<string, ColumnResolution>;
}) {
  const col = (role: string) => resolutions[role]?.column ?? null;
  const testNoCol = col("testNo");
  const materialCol = col("material");
  const thicknessCol = col("thickness");
  const o2iCol = col("o2Initial");
  const o2fCol = col("o2Final");
  const coiCol = col("coInitial");
  const cofCol = col("coFinal");
  const co2iCol = col("co2Initial");
  const co2fCol = col("co2Final");
  const airVelCol = col("airVelStart");
  const piCol = col("pi");

  const columns: TableColumn[] = [
    testNoCol && { key: testNoCol.key, label: testNoCol.label },
    materialCol && { key: materialCol.key, label: materialCol.label },
    thicknessCol && { key: thicknessCol.key, label: thicknessCol.label },
    o2iCol && { key: o2iCol.key, label: `${o2iCol.label} (%)` },
    o2fCol && { key: o2fCol.key, label: `${o2fCol.label} (%)` },
    coiCol && { key: coiCol.key, label: `${coiCol.label} (ppm)` },
    cofCol && { key: cofCol.key, label: `${cofCol.label} (ppm)` },
    co2iCol && { key: co2iCol.key, label: `${co2iCol.label} (%)` },
    co2fCol && { key: co2fCol.key, label: `${co2fCol.label} (%)` },
    airVelCol && { key: airVelCol.key, label: `${airVelCol.label} (cm/s, start)` },
    piCol && { key: piCol.key, label: piCol.label },
  ].filter((c): c is TableColumn => Boolean(c));

  const cell = (raw: DataRow, key: string, readingClass: ReadingClass | undefined, digits = 1) => {
    if (readingClass === "censored" || readingClass === "outOfRange") {
      const marker = raw._rawData?.[key]
      return (
        <span
          className="rounded px-1.5 py-0.5 text-[10px]"
          style={{ background: `${C.amber}22`, color: C.amber }}
          title={`Sensor reading excluded from statistics: ${READING_LABEL[readingClass]}`}
        >
          {marker ?? READING_LABEL[readingClass]}
        </span>
      )
    }
    const v = raw[key]
    if (typeof v === "number" && Number.isFinite(v)) {
      return <span className="tabular-nums">{v.toFixed(digits)}</span>
    }
    return <span style={{ color: C.muted }}>—</span>
  }

  return (
    <div className={panelCls} style={panelStyle}>
      <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
        Data Table
      </h3>
      <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
        Showing first 10 of {filtered.length} filtered rows. Censored or out-of-range sensor
        readings appear as amber markers with their original source text; they are excluded from all
        statistics above.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: C.line }}>
        <table className="w-max min-w-full border-collapse text-left text-[11px]">
          <thead>
            <tr style={{ background: "#16283a" }}>
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium" style={{ color: C.muted }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 10).map((r, i) => (
              <tr key={i} className="border-t" style={{ borderColor: C.line }}>
                {testNoCol && (
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.fg }}>
                    {r.testNo ?? `—`}
                  </td>
                )}
                {materialCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.fg }}>
                    {r.material}
                  </td>
                )}
                {thicknessCol && (
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.fg }}>
                    {r.thickness ?? "—"}
                  </td>
                )}
                {o2iCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.blue }}>
                    {cell(rows[r._idx], o2iCol.key, r.readingClasses.o2i)}
                  </td>
                )}
                {o2fCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.amber }}>
                    {cell(rows[r._idx], o2fCol.key, r.readingClasses.o2f)}
                  </td>
                )}
                {coiCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.fg }}>
                    {cell(rows[r._idx], coiCol.key, r.readingClasses.coi, 0)}
                  </td>
                )}
                {cofCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.pink }}>
                    {cell(rows[r._idx], cofCol.key, r.readingClasses.cof, 0)}
                  </td>
                )}
                {co2iCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.fg }}>
                    {cell(rows[r._idx], co2iCol.key, r.readingClasses.co2i, 2)}
                  </td>
                )}
                {co2fCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.green }}>
                    {cell(rows[r._idx], co2fCol.key, r.readingClasses.co2f, 2)}
                  </td>
                )}
                {airVelCol && (
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: C.fg }}>
                    {r.airVel ?? "—"}
                  </td>
                )}
                {piCol && (
                  <td className="whitespace-nowrap px-3 py-1.5" style={{ color: C.muted }}>
                    {r.pi ?? "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 10 && (
        <p className="mt-2 text-[11px]" style={{ color: C.muted }}>
          Showing 10 of {filtered.length} rows
        </p>
      )}
    </div>
  )
}
