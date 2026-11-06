'use client'

/**
 * Shown when the dashboard can't reach its data (the database is down or
 * unreachable), instead of a raw HTTP 500. "Try again" re-runs the page.
 */
export function DataUnavailable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div id="data-unavailable" className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center text-fg">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t reach the data, try again</h1>
        <p className="mx-auto max-w-sm text-sm opacity-70">
          The dashboard couldn&apos;t reach its database just now. Nothing is lost; this is usually a short network
          hiccup.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => (onRetry ? onRetry() : window.location.reload())}
          className="rounded-full bg-flame-amber px-5 py-2.5 text-sm font-medium text-[#1a0f05] transition hover:bg-[#ffb868]"
        >
          Try again
        </button>
        <a href="/" className="rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition hover:bg-current/10">
          ← Back home
        </a>
      </div>
    </div>
  )
}
