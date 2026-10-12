"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DatasetMeta, DataRow } from "@/components/util";

export default function Visualization({
  dataset,
  rows,
}: {
  dataset: DatasetMeta;
  rows: DataRow[];
}) {
  const numCols = dataset.columns.filter(
    (c) => c.type === "number" || c.type === "integer",
  );

  if (numCols.length < 2) {
    return (
      <div className="rounded-[22px] border border-white/[0.07] bg-[#1c1c24] p-6">
        <h2 className="text-[17px] font-light">Visualization</h2>
        <p className="mt-4 text-[13px] text-white/50">
          This dataset needs at least two numeric columns for visualization.
        </p>
      </div>
    );
  }

  const [xCol, yCol] = numCols;
  const data = rows
    .filter(
      (r) =>
        typeof r[xCol.key] === "number" && typeof r[yCol.key] === "number",
    )
    .map((r) => ({ x: r[xCol.key] as number, y: r[yCol.key] as number }));

  if (data.length === 0) {
    return (
      <div className="rounded-[22px] border border-white/[0.07] bg-[#1c1c24] p-6">
        <h2 className="text-[17px] font-light">Visualization</h2>
        <p className="mt-4 text-[13px] text-white/50">
          No rows have values for both {xCol.label} and {yCol.label}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-[#1c1c24] p-6">
      <h2 className="text-[17px] font-light">Visualization</h2>
      <p className="mt-1 text-[12px] text-white/50">
        {xCol.label} vs {yCol.label} &middot; {data.length} rows
      </p>
      <div className="mt-4 h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="x"
              name={xCol.label}
              stroke="rgba(255,255,255,0.5)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              dataKey="y"
              name={yCol.label}
              stroke="rgba(255,255,255,0.5)"
              fontSize={12}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#1c1c24",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            />
            <Scatter data={data} fill="#6e8cff" opacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
