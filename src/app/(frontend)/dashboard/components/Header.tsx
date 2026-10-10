import { Icon } from "./Card";

function Header({ tabs }: { tabs: string[] }) {
  return (
    <header className="flex items-center justify-between">
      <div className="text-[18px] font-semibold tracking-tight">Freefall labs</div>
      <div className="flex items-center gap-2">
        <nav className="flex rounded-full border border-white/10 bg-[#1c1c24] p-0.5">
          {tabs.map((t, i) => (
            <button
              key={t}
              className={`rounded-full px-4 py-2 text-[12px] ${
                i === 0 ? "bg-[#33333f] text-white" : "text-white/80"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#1c1c24]">
          <Icon d={"M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z"} className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export default Header;