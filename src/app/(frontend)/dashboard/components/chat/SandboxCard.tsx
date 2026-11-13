'use client'

import Link from 'next/link'
import { makeAssistantToolUI } from '@assistant-ui/react'
import { cn } from '@/lib/utils'

interface SandboxResult {
  testId: string
  view: string
  href: string
  nasaOutcome: string | null
  verdict: string | null
  runSteps: number | null
  error?: string
}

const card = 'rounded-lg border border-line bg-ink-2 p-3 text-[12px] mb-5'

const VIEW_LABEL: Record<string, string> = {
  material: 'Material',
  temperature: 'Temperature',
  oxygen: 'Oxygen',
  flow: 'Flow',
  co2: 'CO2',
  co: 'CO',
  camera: 'Camera',
}

export const SandboxCardUI = makeAssistantToolUI<
  { testId: string; view?: string },
  SandboxResult
>({
  toolName: 'openSandbox',
  render: ({ args, result, status }) => {
    if (status.type === 'running') {
      return (
        <div className={card}>
          Preparing simulation for {args?.testId ?? 'test'}…
        </div>
      )
    }
    if (!result) return null
    if (result.error) {
      return <div className={cn(card, 'text-red-300')}>{result.error}</div>
    }

    return (
      <div className={card}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-fg">
              Sandbox: {result.testId}
            </div>
            {result.nasaOutcome && (
              <div className="text-muted">
                NASA: {result.nasaOutcome}
                {result.verdict ? ` · sandbox: ${result.verdict}` : ''}
              </div>
            )}
          </div>
          {result.runSteps != null && (
            <span className="shrink-0 rounded-full bg-flame-amber/20 px-2 py-0.5 text-[11px] font-medium text-flame-amber">
              {result.runSteps} steps
            </span>
          )}
        </div>

        <div className="mt-2 text-muted">
          Recommended view:{' '}
          <span className="font-medium text-fg">
            {VIEW_LABEL[result.view] ?? result.view}
          </span>
        </div>

        <div className="mt-3">
          <Link
            href={result.href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-flame-amber bg-flame-amber px-3 py-1.5 text-[12px] font-medium text-on transition hover:brightness-110"
          >
            Open in sandbox ({VIEW_LABEL[result.view] ?? result.view} view)
          </Link>
        </div>
      </div>
    )
  },
})
