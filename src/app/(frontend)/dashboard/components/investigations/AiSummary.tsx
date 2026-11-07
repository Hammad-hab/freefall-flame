'use client'

/**
 * A plain-language summary from /api/psi-interpretation: the AI's answer
 * (labelled, with its model) when it passes the number check, otherwise the
 * plain summary built from the same facts. `auto` asks at once (the overall
 * ranking); otherwise an "Explain" button asks (one card), so a visit costs at
 * most one paid call until someone asks for more.
 */
import { useCallback, useEffect, useState } from 'react'
import { C } from '../ui/chart-theme'
import Markdown from '../ui/Markdown'

interface Reply {
  fallback?: string[]
  ai?: string | null
  model?: string | null
  rejected?: string | null
  error?: string
}

export default function AiSummary({ id, auto = false, title }: { id: string; auto?: boolean; title: string }) {
  const [reply, setReply] = useState<Reply | null>(null)
  const [busy, setBusy] = useState(false)

  const ask = useCallback(async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/psi-interpretation?id=${encodeURIComponent(id)}`)
      setReply((await res.json()) as Reply)
    } catch {
      setReply({ error: 'The summary could not be loaded.' })
    } finally {
      setBusy(false)
    }
  }, [id])

  useEffect(() => {
    if (auto) void ask()
  }, [auto, ask])

  if (!reply) {
    return auto || busy ? (
      <p className="text-[11px]" style={{ color: C.muted }} data-ai-summary={id} data-state="loading">Loading the summary…</p>
    ) : (
      <button
        onClick={() => void ask()}
        data-explain={id}
        className="self-start rounded-full border px-3 py-1 text-[11px] transition-colors hover:bg-line/50"
        style={{ borderColor: C.line, color: C.fg }}
      >
        Explain {title}
      </button>
    )
  }
  return (
    <div data-ai-summary={id} data-state={reply.ai ? 'ai' : 'plain'} className="rounded-xl border p-3 text-[11px] leading-5" style={{ borderColor: C.line, background: C.ink }}>
      {reply.ai ? (
        <>
          <div className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>AI interpretation ({reply.model}), from the data shown here</div>
          <Markdown text={reply.ai} />
        </>
      ) : (
        <>
          <div className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>Plain summary from the data</div>
          <ul className="space-y-0.5" style={{ color: C.fg }}>
            {(reply.fallback ?? []).map((l, k) => <li key={k}>{l}</li>)}
          </ul>
          {(reply.rejected || reply.error) && (
            <p className="mt-1 text-[10px]" style={{ color: C.muted }}>{reply.rejected ?? reply.error}</p>
          )}
        </>
      )}
    </div>
  )
}
