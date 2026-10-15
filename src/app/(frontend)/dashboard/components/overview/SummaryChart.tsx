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

  return (
    <Card className="grid grid-cols-[300px_1fr] overflow-hidden">
      {/* Summary */}
      <div className="rounded-[22px] border-r border-white/[0.07] bg-[#23232c] p-5">
        <h2 className="text-[17px] font-light">Summary</h2>
        <div className="mt-4 flex gap-2 text-[10px] leading-4 text-white/50">
          <span className="text-white/70">✦</span>
          <p>Size of the dataset</p>
        </div>
        <div className="mt-4 space-y-2.5">
          {items.map((i) => (
            <div
              key={i.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#2b2b36] px-3 py-2.5"
            >
              <div className="flex shrink-0 items-center gap-2 text-[13px]">
                <span className={`h-2 w-2 rounded-full ${i.dot}`} />
                {i.label}
              </div>
              <span className="truncate rounded-full bg-[#3a3a47] px-2.5 py-1 text-[12px] text-white/80">
                {i.n}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="min-w-0 p-5 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-light">{tab === 'Columns' ? 'Columns' : "Dataset Preview"}</h2>
          <div
            role="tablist"
            aria-label="Time range"
            className="flex shrink-0 rounded-full border border-white/10 p-0.5 text-[12px]"
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
                    active ? "bg-[#33333f] text-white" : "text-white/80 hover:text-white"
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
              <ul className="divide-y divide-white/[0.06] text-[12px]">
                {dataset?.columns?.map((col) => (
                  <li key={col.label} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate text-white/90">{col.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {col.unit && <span className="text-[11px] text-white/40">{col.unit}</span>}
                      <span className="rounded-full bg-[#3a3a47] px-2 py-0.5 text-[10px] text-white/70">
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
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-max min-w-full border-collapse text-left text-[12px]">
                  <thead className="bg-[#2b2b36] text-[11px] text-white/60">
                    <tr>
                      {dataset?.columns?.map((col) => (
                        <th key={col.key} className="whitespace-nowrap px-3 py-2 font-medium">
                          {col.label}
                          {col.unit && <span className="ml-1 text-white/30">({col.unit})</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {rows.slice(0, 4).map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.03]">
                        {dataset?.columns?.map((col) => (
                          <td
                            key={col.key}
                            className="max-w-[160px] truncate whitespace-nowrap px-3 py-1.5 tabular-nums text-white/85"
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
                <p className="mt-2 text-[11px] text-white/40">Showing 4 of {rows.length} rows</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default SummaryAndChart;