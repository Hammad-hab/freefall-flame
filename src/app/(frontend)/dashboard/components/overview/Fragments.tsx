import { Arrow, Card, Icon } from "../ui/Card";
import { useState, useMemo, useCallback, useEffect, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { PaperRef } from "@/lib/types";
import type { ShareResult } from "@/lib/shares";
import type { InterpretationSummary } from "@/lib/combustion";
import { C } from "../ui/chart-theme";
import { QUESTION_MAX_CHARS } from "@/lib/ai-limits";
/* ----------------------------- helpers ----------------------------- */

const hatch =
  "bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.14)_0px,rgba(255,255,255,0.14)_1px,transparent_1px,transparent_5px)]";

// Smooth Catmull-Rom -> cubic bezier path through evenly spaced values.
function smoothPath(values: number[], w: number, h: number, min = 100, max = 400) {
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - ((v - min) / (max - min)) * h,
  ]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}


function SummaryAndChart() {
  const items = [
    { label: "Triage", n: "1234", dot: "bg-amber-500" },
    { label: "Fixing", n: "0", dot: "bg-emerald-400" },
    { label: "Investigating", n: "24", dot: "bg-pink-500" },
  ];
  const W = 640;
  const H = 170;
  const blue = [350, 230, 110, 230, 130, 318, 180, 150, 300, 350, 320, 370];
  const pink = [120, 190, 150, 330, 130, 150, 110, 240, 300, 200, 230, 130];
  const xLabels = ["24 Aug", "31 Aug", "7 Sept", "14 Sept", "21 Sept", "28 Sept"];
  const peakLeft = (5 / 11) * 100;
  const peakTop = (1 - (318 - 100) / 300) * 100;

  return (
    <Card className="grid grid-cols-[220px_1fr] overflow-hidden">
      {/* Summary */}
      <div className="rounded-[22px] border-r border-white/[0.07] bg-[#2c2822] p-5">
        <h2 className="text-[17px] font-light">Summary</h2>
        <div className="mt-4 space-y-2.5">
          {items.map((i) => (
            <div key={i.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#363026] px-3 py-2.5">
              <div className="flex items-center gap-2 text-[13px]">
                <span className={`h-2 w-2 rounded-full ${i.dot}`} />
                {i.label}
              </div>
              <span className="rounded-full bg-[#474036] px-2.5 py-1 text-[12px] text-white/80">{i.n}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2 text-[10px] leading-4 text-white/50">
          <span className="text-white/70">✦</span>
          <p>
            Incidents frequency <span className="text-white">spiked in September,</span> show{" "}
            <span className="text-white">higher system pressure</span>
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-light">Incident frequency</h2>
          <div className="flex rounded-full border border-white/10 p-0.5 text-[12px]">
            {["12 months", "30 days", "1 week"].map((t, i) => (
              <span key={t} className={`rounded-full px-4 py-2 ${i === 1 ? "bg-[#3f3830]" : "text-white/80"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex">
          <div className="flex h-[170px] w-8 flex-col justify-between text-[11px] text-white/70">
            {[400, 300, 200, 100].map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>
          <div className="relative flex-1">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="h-[170px] w-full overflow-visible"
            >
              <defs>
                <linearGradient id="blueLine" x1="0" x2="1">
                  <stop offset="0" stopColor="#ffa64d" />
                  <stop offset="0.5" stopColor="#ffc080" />
                  <stop offset="1" stopColor="#ffb868" />
                </linearGradient>
                <linearGradient id="pinkLine" x1="0" x2="1">
                  <stop offset="0" stopColor="#e5397f" />
                  <stop offset="1" stopColor="#ff7ab0" />
                </linearGradient>
              </defs>
              {[1, 3, 5, 7, 9, 11].map((i) => (
                <line
                  key={i}
                  x1={(i / 11) * W}
                  x2={(i / 11) * W}
                  y1={0}
                  y2={H}
                  stroke="white"
                  strokeOpacity={0.08}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path d={smoothPath(pink, W, H)} fill="none" stroke="url(#pinkLine)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <path d={smoothPath(blue, W, H)} fill="none" stroke="url(#blueLine)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </svg>

            {/* peak marker */}
            <span
              className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-[#ffa64d] shadow-[0_0_0_5px_rgba(110,140,255,0.25)]"
              style={{ left: `${peakLeft}%`, top: `${peakTop}%` }}
            />
            <div
              className="absolute rounded-lg border border-white/10 bg-[#363026] px-2 py-1.5 text-[11px] leading-4"
              style={{ left: `${peakLeft}%`, top: -26, transform: "translateX(-10%)" }}
            >
              7 September
              <br />
              318 Incidents
            </div>

            <div className="mt-2 flex justify-between pl-1 pr-4 text-[11px] text-white/70">
              {xLabels.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Vulnerability() {
  // min-h reserves room for the decorative card stack: it is absolutely positioned against
  // the bottom edge and would be clipped once the card is no longer stretched to the
  // height of a taller grid sibling.
  return (
    <div className="relative min-h-[260px] overflow-hidden rounded-[22px] bg-flame-amber text-[#1a0f05] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px]">Sources</h2>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25">
          <Arrow />
        </span>
      </div>
      <p className="mt-4 text-[14px] leading-5  text-[#1a0f05]">
        Encryption ensures supplier data remains consistently secure from breaches
      </p>
      <div className="absolute inset-x-5 bottom-4 h-[120px]">
        <div className="absolute inset-x-2 bottom-0 h-14 rounded-xl bg-white/20" />
        <div className="absolute inset-x-0 top-[50px] flex h-[48px] -rotate-[3deg] items-start justify-between rounded-xl bg-[#ffe8d6] px-3 pt-2.5 text-[14px] text-[#1c1c24] shadow-lg">
          <span>Thread</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2a2118] text-[11px] text-white">1</span>
        </div>
        <div className="absolute inset-x-0 top-0 flex h-[54px] -rotate-[3deg] items-center justify-between rounded-xl bg-white px-3 text-[14px] text-[#1c1c24] shadow-lg">
          <span>Priority</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2a2118] text-[11px] text-white">3</span>
        </div>
      </div>
    </div>
  );
}

function ActiveIncidents() {
  return (
  <Card className="@container p-5">
  <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-light">Key Findings</h2>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {["Newest", "All"].map((t) => (
            <span key={t} className="flex items-center gap-4 rounded-full border border-white/10 px-3 py-2">
              {t}
              <Icon d="M6 9l6 6 6-6" className="h-3 w-3" />
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 items-end gap-3 @xl:grid-cols-2">
        {[
          {
            tag: "Fixing",
            tagCls: "bg-white text-[#1c1c24]",
            text: "The system failed to send the summary update the message to all users",
            name: "Tommy White",
            email: "tommywh@gmail.com",
          },
          {
            tag: "Investigating",
            tagCls: "bg-[#ffa64d] text-white",
            text: "High error rate in user service and issues",
            name: "Elizabeth Belle",
            email: "eliebelle@gmail.com",
          },
        ].map((c) => (
          <div key={c.name} className="rounded-2xl border border-white/10 bg-[#2c2822] p-3.5">
            <div className="flex items-start justify-between">
              <span className={`rounded-full px-3 py-1.5 text-[12px] ${c.tagCls}`}>{c.tag}</span>
              <div className="text-right text-[11px] leading-4 text-white/70">
                INC-0000
                <br />
                7h 7m
              </div>
            </div>
            <p className="mt-3 min-h-[54px] text-[12.5px] leading-5 text-white/90">{c.text}</p>
            <div className="mt-3 flex items-center gap-2">
              <div>
                <div className="text-[14px]">{c.name}</div>
                <div className="text-[11px] text-white/70">{c.email}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-light">Statistics</h2>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#2c2822]">
          <Arrow />
        </span>
      </div>

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

      {/* page curl */}
      <div className="absolute -bottom-1 left-0 h-9 w-16 [clip-path:polygon(0_0,100%_100%,0_100%)] bg-gradient-to-br from-[#2b2b36] to-[#0e0e12]" />
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

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: C.muted }} />
      <span>{text}</span>
    </div>
  )
}

function truncateAnswer(text: string, maxChars: number): { truncated: string; isTruncated: boolean } {
  if (text.length <= maxChars) return { truncated: text, isTruncated: false };
  const truncated = text.slice(0, maxChars);
  const lastPeriod = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("! "),
    truncated.lastIndexOf("? ")
  );
  const cut = lastPeriod !== -1 ? lastPeriod + 1 : maxChars;
  return { truncated: truncated.slice(0, cut), isTruncated: true };
}

function truncateInterpretations(interpretations: string, maxChars: number): { truncated: string; isTruncated: boolean } {
  if (interpretations.length <= maxChars) return { truncated: interpretations, isTruncated: false };
  const truncated = interpretations.slice(0, maxChars);
  const lastPeriod = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("! "),
    truncated.lastIndexOf("? ")
  );
  const cut = lastPeriod !== -1 ? lastPeriod + 1 : maxChars;
  return { truncated: truncated.slice(0, cut), isTruncated: true };
}

function truncateText(text: string, maxChars: number): { truncated: string; isTruncated: boolean } {
  if (text.length <= maxChars) return { truncated: text, isTruncated: false };
  const truncated = text.slice(0, maxChars);
  const lastPeriod = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("! "),
    truncated.lastIndexOf("? ")
  );
  const cut = lastPeriod !== -1 ? lastPeriod + 1 : maxChars;
  return { truncated: truncated.slice(0, cut), isTruncated: true };
}

function Assistant({ datasetId, datasetName, className = '' }: AssistantProps) {
  const router = useRouter();
  const [material, setMaterial] = useState<string>("all")

  const [question, setQuestion] = useState("")
  const [data, setData] = useState<InterpretationResponse | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        setModel(json.model ?? null)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [datasetId, material, question],
  )

  const summary = useMemo(() => {
    if (!data) return null
    const parts: string[] = []
    const obs = data.fallback.observations.filter(Boolean).join(" ")
    if (obs) parts.push(obs)
    if (answer) {
      parts.push(answer)
    } else {
      const dets = data.fallback.interpretations.filter(Boolean).join(" ")
      if (dets) parts.push(dets)
    }
    const uncs = data.fallback.uncertainties.filter(Boolean).join(" ")
    if (uncs) parts.push(uncs)
    return truncateText(parts.join(" "), 350)
  }, [data, answer])

  return (
    <Card className={`@container relative p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[17px] font-light">Ask about this dataset</div>
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
              {materials.map((m) => (
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

      {data && !loading && summary && (
        <Section title="Summary" accent={C.amber}>
          <p className="whitespace-pre-wrap text-[12px] leading-6" style={{ color: C.fg }}>
            {summary.truncated}
          </p>
          {summary.isTruncated && (
            <>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <button
                type="button"
                onClick={() => {
                  const u = new URL(window.location.href)
                  u.searchParams.set("tab", "ai-summary")
                  router.push(u.toString())
                }}
                className="relative mt-2 text-[12px] font-medium text-flame-amber transition-colors hover:text-white"
              >
                Read more
              </button>
            </>
          )}
        </Section>
      )}
    </Card>
  )
}

export {
  SummaryAndChart,
  Vulnerability,
  ActiveIncidents,
  Statistics,
  Assistant,
};
