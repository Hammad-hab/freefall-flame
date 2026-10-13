"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "./Card";
import Link from "next/link";

const TABS = ["Overview", "AI Summary", "Referenced Papers", "Visualization"] as const;
type TabName = (typeof TABS)[number];

function Header({ activeTab }: { activeTab: TabName }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // const selectTab = (tab: TabName) => {
  //   const params = new URLSearchParams(searchParams.toString());
  //   params.set("tab", tab);
  //   router.replace(`?${params.toString()}`, { scroll: false });
  // };

  return (
    <header className="flex items-center justify-between">
      <div className="text-[18px] font-semibold tracking-tight">Freefall labs</div>
      <div className="flex items-center gap-2">
        <nav className="flex rounded-full border border-white/10 bg-[#1c1c24] p-0.5">
          {TABS.map((t) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", t);
          
            return (
              <Link
                key={t}
                href={`?${params.toString()}`}
                scroll={false}
                aria-current={t === activeTab ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-[12px] transition-colors cursor-pointer ${
                  t === activeTab
                    ? "bg-[#33333f] text-white"
                    : "text-white/80 hover:text-white"
                }`}
              >
                {t}
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
