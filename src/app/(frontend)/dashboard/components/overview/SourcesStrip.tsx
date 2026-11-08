"use client";

import { useMemo } from "react";
import type { DataRow, DatasetMeta, PaperRef } from "@/lib/types";
import { C, panelCls, panelStyle } from "../ui/chart-theme";

/**
 * Sources strip — dataset-wide papers plus row-level (_paper) provenance.
 *
 * Rules honored here:
 *  - Papers are linked to their verified NTRS citation when an NTRS ID is
 *    present (the NASA NTRS citation URL pattern is the verifiable link).
 *  - A paper without any identifier is shown as metadata only; no link is
 *    presented as authoritative.
 *  - Row-level paper references that cannot be resolved to a known paper are
 *    reported as unresolved instead of being dropped silently.
 */
export default function SourcesStrip({
  dataset,
  rows,
}: {
  dataset: DatasetMeta;
  rows: DataRow[];
}) {
  // Row-level paper usage, counted from the flattened _paper field.
  const rowPaperCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r._paper !== null && r._paper !== undefined) {
        const k = String(r._paper);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return counts;
  }, [rows]);

  const knownIds = new Set(dataset.papers.map((p) => String(p.id)))
  const unresolved = [...rowPaperCounts.keys()].filter((id) => !knownIds.has(id))
  const totalLinkedRows = [...rowPaperCounts.values()].reduce((a, b) => a + b, 0)

  if (dataset.papers.length === 0 && totalLinkedRows === 0) {
    return (
      <div className={panelCls} style={panelStyle}>
        <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
          Sources
        </h3>
        <p className="mt-2 text-[12px]" style={{ color: C.muted }}>
          No papers are linked to this dataset yet. Sources are shown here once an administrator
          links them.
        </p>
      </div>
    )
  }

  return (
    <div className={panelCls} style={panelStyle}>
      <h3 className="text-[14px] font-medium" style={{ color: C.fg }}>
        Sources
      </h3>
      <p className="mt-1 text-[11px]" style={{ color: C.muted }}>
        Dataset-wide sources and per-row paper references. A linked paper is not evidence that it
        supports any particular chart value.
      </p>

      <div className="mt-3 space-y-2">
        {dataset.papers.map((p: PaperRef) => (
          <div
            key={p.id}
            className="rounded-xl border p-3 text-[12px]"
            style={{ borderColor: C.line, background: C.panel2 }}
          >
            <div className="leading-5" style={{ color: C.fg }}>
              {p.title}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: C.muted }}>
              {p.ntrsId && (
                <a
                  href={`https://ntrs.nasa.gov/citations/${p.ntrsId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full px-2 py-0.5 transition-colors hover:underline"
                  style={{ background: C.chip2, color: C.accentText }}
                  title="Verified NASA NTRS citation"
                >
                  NTRS: {p.ntrsId} ↗
                </a>
              )}
              {p.sourceUrl && !p.ntrsId && (
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: C.accentText }}
                  className="hover:underline"
                >
                  Source link ↗
                </a>
              )}
              {!p.ntrsId && !p.sourceUrl && (
                <span className="rounded-full px-2 py-0.5" style={{ background: C.chip2 }}>
                  Metadata only — no verified link
                </span>
              )}
              <span>Dataset-wide source</span>
              {rowPaperCounts.has(String(p.id)) && (
                <span style={{ color: C.accentText }}>
                  · linked to {rowPaperCounts.get(String(p.id))} row
                  {(rowPaperCounts.get(String(p.id)) ?? 0) === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        ))}

        {unresolved.length > 0 && (
          <div
            className="rounded-xl border p-3 text-[12px]"
            style={{ borderColor: C.line, background: C.panel2, color: C.muted }}
          >
            {unresolved.length} row-level paper reference{(unresolved.length === 1) ? "" : "s"} could
            not be resolved to a paper in this dataset (id{unresolved.length === 1 ? "" : "s"}:{" "}
            {unresolved.join(", ")}). The reference is kept but shown as unresolved.
          </div>
        )}
      </div>
    </div>
  );
}
