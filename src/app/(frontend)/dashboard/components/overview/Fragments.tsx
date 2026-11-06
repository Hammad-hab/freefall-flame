import { Card } from "../ui/Card";
import { useState, useMemo, useCallback, useEffect, type FormEvent, type ReactNode } from "react";
import type { PaperRef } from "@/lib/types";
import type { ShareResult } from "@/lib/shares";
import type { InterpretationSummary } from "@/lib/combustion";
import { C } from "../ui/chart-theme";
import { QUESTION_MAX_CHARS } from "@/lib/ai-limits";

// The dashboard template's placeholder cards ("Incident frequency", "Key
// Findings" with made-up people, and the "Sources" card about encryption) were
// removed in feat/polish; the Overview's numbers card is KeyNumbers.tsx.

/* ----------------------------- helpers ----------------------------- */

const hatch =
  "bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.14)_0px,rgba(255,255,255,0.14)_1px,transparent_1px,transparent_5px)]";

/**
 * Share-of-rows breakdown, rendered as proportional circles.
 *
 * Replaces the original fixed 64/26/15 "Fixing / Investigating / Triage"
 * circles, which were template filler with no relationship to the dataset.
 * Now every circle is sized and labelled from the same `computeShares` result
 * the header bar uses, so the two can never disagree.
 *
 * Circle area is proportional to share (radius ∝ √share) — the original
 * circles were sized by eye, which is why 64% looked smaller than 26%.
 */
function Statistics({ shares }: { shares: ShareResult }) {
  const { groupLabel, total, shares: entries } = shares

  // Scale the largest share to the card's usable width, then size the rest by
  // area. Radius, not diameter, is what the eye compares.
  const maxShare = Math.max(0, ...entries.map((s) => s.share))
  const radiusFor = (share: number) =>
    maxShare > 0 ? 26 + (Math.sqrt(share / maxShare) * 26) : 0

  return (
    <Card className="relative overflow-hidden p-5">
      <h2 className="text-[17px] font-light">Statistics</h2>

      {entries.length === 0 ? (
        <p className="mt-6 text-[12px] leading-5 text-white/50">
          No rows to break down yet.
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            {entries.map((s) => {
              const size = radiusFor(s.share) * 2
              return (
                <div key={s.label} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex items-center justify-center rounded-full text-center ${
                      s.other ? `border border-white/10 bg-[#3f3830] text-white/80 ${hatch}` : 'bg-flame-amber text-[#1a0f05]'
                    }`}
                    style={{ width: size, height: size, minWidth: 26, minHeight: 26 }}
                    title={`${s.label}: ${s.count} of ${total} rows (${s.share.toFixed(1)}%)`}
                  >
                    <span className={s.share >= 25 ? 'text-[15px] font-light' : 'text-[11px] font-light'}>
                      {Math.round(s.share)}%
                    </span>
                  </div>
                  <span className="max-w-[88px] truncate text-[10px] text-white/60">{s.label}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-white/40">
            Share of rows by {groupLabel ?? 'value'} · {total} rows. Circle area is proportional to
            share.
          </p>
        </>
      )}
    </Card>
  )
}

interface AssistantProps {
  datasetId: string
  datasetName: string
  className?: string
}

type InterpretationResponse = {
  summary: InterpretationSummary
  papers: Array<Partial<PaperRef> & { id: number | string }>
  fallback: { observations: string[]; interpretations: string[]; uncertainties: string[] }
  ai: string | null
  answer: string | null
  model: string | null
  allMaterials: string[]
}

function Section({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-[13px] font-medium" style={{ color: accent }}>{title}</h3>
      <div className="mt-2 space-y-2 text-[12px] leading-5" style={{ color: C.fg }}>{children}</div>
    </div>
  )
}

/**
 * Ask about this dataset. An answer, when there is one, comes first and in
 * full. Below it, what the data shows: the first observation, with "Read more"
 * opening the rest of the observations in place.
 */
function Assistant({ datasetId, datasetName, className = '' }: AssistantProps) {
  const [material, setMaterial] = useState<string>("all")

  const [question, setQuestion] = useState("")
  const [data, setData] = useState<InterpretationResponse | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(false)

  const materials = useMemo(
    () => (data?.allMaterials ? ["all", ...data.allMaterials] : ["all"]),
    [data],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const qs = new URLSearchParams({ dataset: datasetId })
      if (material !== "all") qs.set("material", material)
      const res = await fetch(`/api/interpretation?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load interpretation")
      setData(json as InterpretationResponse)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [datasetId, material])

  useEffect(() => {
    void load()
  }, [load])

  const ask = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!question.trim()) return
      setLoading(true)
      setError(null)
      setAnswer(null)
      try {
        const qs = new URLSearchParams({ dataset: datasetId, question: question.trim() })
        if (material !== "all") qs.set("material", material)
        const res = await fetch(`/api/interpretation?${qs}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to ask")
        setAnswer(json.answer ?? null)
        setModel(json.answerModel ?? json.model ?? null)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [datasetId, material, question],
  )

  const observations = data?.fallback.observations.filter(Boolean) ?? []

  return (
    <Card className={`@container relative p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[17px] font-light" title={datasetName}>Ask about this dataset</div>
          <p className="mt-1 text-[12px] leading-5 text-white/55">
            Grounded in this dataset&apos;s measured summary and linked papers. Ask anything; interpretations are
            labelled as interpretations.
          </p>
        </div>
        {materials.length > 1 && (
          <label className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
            Material
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px]"
              style={{ borderColor: C.line, background: C.panel2, color: C.fg }}
            >
              <option value="all">All materials</option>
              {materials.filter((m) => m !== "all").map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <form onSubmit={ask} className="mt-4">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={QUESTION_MAX_CHARS}
            placeholder="Ask about this dataset…"
            className="min-w-0 flex-1 rounded-lg border border-white/10 px-3 py-2 text-[12px] leading-5 outline-none focus:border-blue"
            style={{ color: C.fg, background: C.panel2, borderColor: C.line }}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-full border bg-flame-amber px-4 py-2 text-[12px] font-medium text-[#1a0f05] hover:bg-[#ffb868] disabled:opacity-40"
          >
            {loading ? "Asking…" : "Ask"}
          </button>
        </div>
        {question.trim() !== "" && (
          <p className="mt-1 text-[11px] text-white/50">
            Asking routes the grounded summary to the AI service when one is configured.
          </p>
        )}
      </form>

      {error && <p className="mt-4 text-[13px]" style={{ color: C.red }}>{error}</p>}
      {loading && !data && (
        <p className="mt-4 text-[13px]" style={{ color: C.muted }}>Building grounded summary…</p>
      )}

      {/* The answer first, in full. */}
      {answer && (
        <Section title="Answer" accent={C.amber}>
          <p id="assistant-answer" className="whitespace-pre-wrap text-[12px] leading-6" style={{ color: C.fg }}>{answer}</p>
          <p className="text-[10px]" style={{ color: C.muted }}>AI interpretation{model ? ` (${model})` : ''}, grounded in the summary below.</p>
        </Section>
      )}

      {/* What the data shows: the first observation; "Read more" opens the rest in place. */}
      {data && observations.length > 0 && (
        <Section title="What the data shows" accent={answer ? C.muted : C.amber}>
          <div id="assistant-observations" className="space-y-2">
            {(more ? observations : observations.slice(0, 1)).map((o, k) => (
              <p key={k} className="text-[12px] leading-6" style={{ color: C.fg }}>{o}</p>
            ))}
          </div>
          {observations.length > 1 && (
            <button
              type="button"
              onClick={() => setMore((m) => !m)}
              aria-expanded={more}
              className="mt-1 text-[12px] font-medium text-flame-amber transition-colors hover:text-white"
            >
              {more ? "Show less" : `Read more (${observations.length - 1} more)`}
            </button>
          )}
        </Section>
      )}
    </Card>
  )
}

export {
  Statistics,
  Assistant,
};
