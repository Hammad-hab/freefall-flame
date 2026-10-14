"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "./Card";
import Link from "next/link";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "visualization", label: "Visualization" },
  { id: "ai-summary", label: "Interpretation" },
  { id: "papers", label: "Referenced Papers" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Header({ activeTab }: { activeTab: TabId }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <header className="flex items-center justify-between">
      <div className="text-[18px] font-semibold tracking-tight">Freefall labs</div>
      <div className="flex items-center gap-2">
        <nav
          className="flex rounded-full border border-white/10 bg-[#1c1c24] p-0.5"
          aria-label="Dashboard sections"
        >
          {TABS.map((t) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", t.id);

            return (
              <Link
                key={t.id}
                href={`?${params.toString()}`}
                scroll={false}
                aria-current={t.id === activeTab ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-[12px] transition-colors cursor-pointer ${
                  t.id === activeTab
                    ? "bg-[#33333f] text-white"
                    : "text-white/80 hover:text-white"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#1c1c24]">
          <Icon
            d={"M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z"}
            className="h-4 w-4"
          />
        </button>
      </div>
    </header>
  );
}

export default Header;
