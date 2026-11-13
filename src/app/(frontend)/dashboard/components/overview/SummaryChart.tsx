"use client";

import { useState } from "react";
import { Card } from "../ui/Card";
import type { DataRow, DatasetMeta } from "@/lib/types";

const TABS = ["Columns", "Dataset"] as const;

function SummaryAndChart({ dataset, rows }: { dataset: DatasetMeta | null; rows: DataRow[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Columns");
  const items = [
    {
      label: "Columns",
      n: dataset?.columns?.length ?? 0,
      dot: "bg-emerald-400",
    },
    {
      label: "Last Updated",
      n: dataset?.lastImportedAt
        ? new Date(dataset.lastImportedAt).toLocaleDateString()
        : "—",
      dot: "bg-pink-500",
    },
  ];

  // @container, so the summary/chart split follows the card's own width rather than the
  // pane's: the card is one column of a grid that itself collapses. flex-wrap does the
  // collapsing — the summary stays full width until the card is wide enough for a 300px
  // sidebar beside the chart.
  return (
    <Card className="@container flex flex-wrap overflow-hidden">
      {/* Summary */}
      <div className="w-full shrink-0 rounded-[22px] border-b border-line bg-[var(--c-panel2)] p-5 @2xl:w-[300px] @2xl:border-b-0 @2xl:border-r">
        <h2 className="text-[17px] font-light">Summary</h2>
        <div className="mt-4 flex gap-2 text-[10px] leading-4 text-muted">
          <span className="text-fg">✦</span>
          <p>Size of the dataset</p>
        </div>
        <div className="mt-4 space-y-2.5">
          {items.map((i) => (
            <div
              key={i.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[var(--c-surface)] px-3 py-2.5"
            >
              <div className="flex shrink-0 items-center gap-2 text-[13px]">
                <span className={`h-2 w-2 rounded-full ${i.dot}`} />
                {i.label}
              </div>
              <span className="truncate rounded-full bg-[var(--c-chip2)] px-2.5 py-1 text-[12px] text-fg">
                {i.n}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="min-w-0 flex-1 basis-[300px] p-5 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-light">{tab === 'Columns' ? 'Columns' : "Dataset Preview"}</h2>
          <div
            role="tablist"
            aria-label="Time range"
            className="flex shrink-0 rounded-full border border-line p-0.5 text-[12px]"
          >
            {TABS.map((t) => {
              const active = t === tab;
              return (
                <button
                  key={t}
                  id={`tab-${t}`}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-controls="chart-panel"
                  onClick={() => setTab(t)}
                  className={`rounded-full px-4 py-2 transition-colors ${
                    active ? "bg-[color-mix(in_srgb,var(--c-surface),var(--c-chip2))] text-fg" : "text-fg hover:text-fg"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="chart-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="mt-4"
        >
          {/* swap this for your chart, keyed off `tab` */}
          {tab === "Columns" && (
            <div className="mt-4 max-h-[170px] overflow-y-auto pr-1">
              <ul className="divide-y divide-line text-[12px]">
                {dataset?.columns?.map((col) => (
                  <li key={col.label} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate text-fg">{col.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {col.unit && <span className="text-[11px] text-muted">{col.unit}</span>}
                      <span className="rounded-full bg-[var(--c-chip2)] px-2 py-0.5 text-[10px] text-fg">
                        {col.type}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab === "Dataset" && (
            <div className="mt-4">
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-max min-w-full border-collapse text-left text-[12px]">
                  <thead className="bg-[var(--c-surface)] text-[11px] text-muted">
                    <tr>
                      {dataset?.columns?.map((col) => (
                        <th key={col.key} className="whitespace-nowrap px-3 py-2 font-medium">
                          {col.label}
                          {col.unit && <span className="ml-1 text-muted">({col.unit})</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.slice(0, 4).map((row, i) => (
                      <tr key={i} className="hover:bg-fg/[0.03]">
                        {dataset?.columns?.map((col) => (
                          <td
                            key={col.key}
                            className="max-w-[160px] truncate whitespace-nowrap px-3 py-1.5 tabular-nums text-fg"
                          >
                            {String(row[col.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 4 && (
                <p className="mt-2 text-[11px] text-muted">Showing 4 of {rows.length} rows</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default SummaryAndChart;