import type { PaperRef } from "@/components/util";

export default function ReferencedPapers({ papers }: { papers: PaperRef[] }) {
  if (papers.length === 0) {
    return (
      <div className="rounded-[22px] border border-white/[0.07] bg-[#1c1c24] p-6">
        <h2 className="text-[17px] font-light">Referenced Papers</h2>
        <p className="mt-4 text-[13px] text-white/50">
          No papers are linked to this dataset yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-[#1c1c24] p-6">
      <h2 className="text-[17px] font-light">Referenced Papers</h2>
      <div className="mt-4 space-y-3">
        {papers.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-white/10 bg-[#23232c] p-4"
          >
            <div className="text-[14px] leading-5 text-white/90">{p.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/50">
              {p.ntrsId && (
                <span className="rounded-full bg-[#3a3a47] px-2.5 py-1 text-white/70">
                  NTRS: {p.ntrsId}
                </span>
              )}
              {p.sourceUrl && (
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6e8cff] transition-colors hover:text-[#8ea2ff] hover:underline"
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
