"use client";

import { useState } from "react";

export default function AISummary({
  datasetId,
  datasetName,
}: {
  datasetId: string;
  datasetName: string;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Summarize the combustion research dataset "${datasetName}" (ID: ${datasetId}). Describe what it contains, the key variables, and any notable patterns or findings.`,
          system:
            "You are a concise research data summarizer. Keep summaries under 200 words. Use clear, non-technical language where possible.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate summary");
      setSummary(data.output);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-[#1c1c24] p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-light">AI Summary</h2>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-full bg-[#3d3df5] px-4 py-2 text-[12px] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Summary"}
        </button>
      </div>
      {error && <p className="mt-4 text-[13px] text-red-400">{error}</p>}
      {summary && (
        <p className="mt-4 text-[13px] leading-6 whitespace-pre-wrap text-white/85">
          {summary}
        </p>
      )}
      {!summary && !error && !loading && (
        <p className="mt-4 text-[13px] text-white/50">
          Click &quot;Generate Summary&quot; to create an AI-powered summary of this
          dataset.
        </p>
      )}
    </div>
  );
}
