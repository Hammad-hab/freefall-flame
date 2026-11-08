"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PaperRef } from "@/lib/types";
import { C, panelCls, panelStyle } from "../ui/chart-theme";
import Markdown from "../ui/Markdown";

type Response = {
  summary: {
    datasetName: string
    totalTests: number
    materials: string[]
    byMaterial: Record<
      string,
      {
        tests: number
        o2Conditions: number
        o2Min: number | null
        o2Max: number | null
        meanO2Consumed: number | null
        o2ConsumedN: number
        meanCoProduced: number | null
        meanCo2Produced: number | null
        excludedCensored: number
        excludedOutOfRange: number
        excludedMissing: number
      }
    >
    totalExcluded: { censored: number; outOfRange: number; missing: number }
    hasCensoredReadings: boolean
  }
  papers: Partial<PaperRef>[]
  fallback: { observations: string[]; interpretations: string[]; uncertainties: string[] }
  ai: string | null
  model: string | null
  allMaterials: string[]
}

/**
 * "What Do These Results Tell Us?"
 *
 * Grounded interpretation panel. All numerical claims come from the compact
 * validated summary computed on the server (never the raw dataset). When an
 * AI service is configured its output is shown as an *interpretation aid* next
 * to the deterministic observations, with the model named; otherwise the
 * deterministic fallback is used and clearly labelled. Every research claim
 * cites the papers associated with the dataset.
 */
export default function InterpretationPanel({
  datasetId,
  datasetName,
}: {
  datasetId: string
  datasetName: string
}) {
  const [material, setMaterial] = useState<string>("all")
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const materials = useMemo(
    () => (data?.allMaterials ? ["all", ...data.allMaterials] : ["all"]),
    [data],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ dataset: datasetId })
      if (material !== "all") qs.set("material", material)
      const res = await fetch(`/api/interpretation?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load interpretation")
      setData(json as Response)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [datasetId, material])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className={panelCls} style={panelStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-light" style={{ color: C.fg }}>
              What Do These Results Tell Us?
            </h2>
            <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
              Grounded only in this dataset&apos;s measured summaries and its linked research papers.
              Observations, interpretations, and uncertainties are kept separate.
            </p>
          </div>
          {materials.length > 1 && (
            <label className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
              Material
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="rounded-lg border px-2 py-1.5 text-[11px]"
                style={{ borderColor: C.line, background: C.panel2, color: C.fg }}
              >
                <option value="all">All materials</option>
                {materials
                  .filter((m) => m !== "all")
                  .map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>

        {error && <p className="mt-4 text-[13px]" style={{ color: C.red }}>{error}</p>}
        {loading && <p className="mt-4 text-[13px]" style={{ color: C.muted }}>Building grounded summary…</p>}

        {data && !loading && (
          <>
            {/* Deterministic observations — always present */}
            <Section title="What the data shows (measured)" accent={C.blue}>
              {data.fallback.observations.map((o, i) => (
                <Bullet key={i} text={o} />
              ))}
            </Section>

            {/* Interpretation — AI-assisted when available, labelled either way */}
            <Section
              title={data.ai ? `What it may mean (AI-assisted interpretation${data.model ? ` — ${data.model}` : ""})` : "What it may mean (deterministic interpretation)"}
              accent={C.amber}
            >
              {data.ai ? (
                <>
                  <p className="mb-2 text-[11px]" style={{ color: C.muted }}>
                    Generated from the compact summary only — not from the raw dataset. Verify each
                    claim against the measured values above and the cited papers.
                  </p>
                  <Markdown text={data.ai} className="text-[12px] leading-6" />
                </>
              ) : (
                <>
                  <p className="mb-2 text-[11px]" style={{ color: C.muted }}>
                    No AI service is configured on the server, so this is a deterministic reading of
                    the measured summary — not an AI-generated analysis.
                  </p>
                  {data.fallback.interpretations.map((t, i) => (
                    <Bullet key={i} text={t} />
                  ))}
                </>
              )}
            </Section>

            <Section title="What remains uncertain" accent={C.red}>
              {data.fallback.uncertainties.map((u, i) => (
                <Bullet key={i} text={u} />
              ))}
            </Section>

            {/* Research sources for any claim above */}
            {data.papers.length > 0 && (
              <Section title="Linked research sources" accent={C.green}>
                <p className="mb-2 text-[11px]" style={{ color: C.muted }}>
                  Cited here for traceability. A linked paper is not evidence that it supports any
                  particular chart value.
                </p>
                <ul className="space-y-1.5">
                  {data.papers.map((p) => (
                    <li key={p.id} className="text-[12px] leading-5" style={{ color: C.fg }}>
                      <span className="font-medium">{p.title}</span>
                      {p.ntrsId && (
                        <a
                          href={`https://ntrs.nasa.gov/citations/${p.ntrsId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-[11px]"
                          style={{ color: C.accentText }}
                        >
                          NTRS: {p.ntrsId} ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  accent,
  children,
}: {
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-5">
      <h3 className="text-[13px] font-medium" style={{ color: accent }}>
        {title}
      </h3>
      <div className="mt-2 space-y-2 text-[12px] leading-5" style={{ color: C.fg }}>
        {children}
      </div>
    </div>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: C.muted }} />
      <span>{text}</span>
    </div>
  )
}
