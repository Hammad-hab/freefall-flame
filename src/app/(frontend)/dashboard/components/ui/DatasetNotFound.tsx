import Link from "next/link";

/**
 * Shown when /dashboard?dataset=<id> names no published dataset. In the
 * dashboard's own style (the same layout as DataUnavailable): what happened,
 * and two ways on.
 */
export function DatasetNotFound({ requested }: { requested?: string }) {
  // Whatever was in the address, shown as text (React escapes it) and kept short.
  const id = requested && requested.length > 40 ? `${requested.slice(0, 40)}…` : requested;
  return (
    <div id="dataset-not-found" className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center text-fg">
      <div className="rounded-[22px] border border-line bg-ink-2 px-8 py-7">
        <div className="mb-3 text-[10px] uppercase tracking-wider opacity-60">Flame in Freefall · dashboard</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t find that dataset</h1>
          <p className="mx-auto max-w-sm text-sm opacity-70">
            {id ? <>No published dataset has the id &ldquo;{id}&rdquo;.</> : <>No published dataset matches this link.</>}{" "}
            It may have been unpublished, or the link may be mistyped.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            data-open-default
            className="rounded-full bg-flame-amber px-5 py-2.5 text-sm font-medium text-on transition hover:brightness-110"
          >
            Open the BASS-II dataset
          </Link>
          <Link href="/" className="rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition hover:bg-current/10">
            ← Home
          </Link>
        </div>
      </div>
    </div>
  );
}
