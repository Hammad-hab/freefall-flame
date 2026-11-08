import type { PaperRef } from "@/lib/types";

export default function ReferencedPapers({ papers }: { papers: PaperRef[] }) {
  if (papers.length === 0) {
    return (
      <div className="rounded-[22px] border border-line bg-[var(--c-panel)] p-6">
        <h2 className="text-[17px] font-light">Referenced Papers</h2>
        <p className="mt-4 text-[13px] text-muted">
          No papers are linked to this dataset yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-line bg-[var(--c-panel)] p-6">
      <h2 className="text-[17px] font-light">Referenced Papers</h2>
      <div className="mt-4 space-y-3">
        {papers.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-line bg-[var(--c-panel2)] p-4"
          >
            <div className="text-[14px] leading-5 text-fg">{p.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
              {p.ntrsId && (
                <span className="rounded-full bg-[var(--c-chip2)] px-2.5 py-1 text-fg">
                  NTRS: {p.ntrsId}
                </span>
              )}
              {p.sourceUrl && (
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-flame-blue transition-colors hover:underline hover:opacity-80"
                >
                  View source &rarr;
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
