import { Arrow, Card, Icon } from "./Card";

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
    { label: "Triage", n: "1234", dot: "bg-blue-500" },
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
      <div className="rounded-[22px] border-r border-white/[0.07] bg-[#23232c] p-5">
        <h2 className="text-[17px] font-light">Summary</h2>
        <div className="mt-4 space-y-2.5">
          {items.map((i) => (
            <div key={i.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#2b2b36] px-3 py-2.5">
              <div className="flex items-center gap-2 text-[13px]">
                <span className={`h-2 w-2 rounded-full ${i.dot}`} />
                {i.label}
              </div>
              <span className="rounded-full bg-[#3a3a47] px-2.5 py-1 text-[12px] text-white/80">{i.n}</span>
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
              <span key={t} className={`rounded-full px-4 py-2 ${i === 1 ? "bg-[#33333f]" : "text-white/80"}`}>
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
                  <stop offset="0" stopColor="#4f46e5" />
                  <stop offset="0.5" stopColor="#8ea2ff" />
                  <stop offset="1" stopColor="#6366f1" />
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
              className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-[#6e8cff] shadow-[0_0_0_5px_rgba(110,140,255,0.25)]"
              style={{ left: `${peakLeft}%`, top: `${peakTop}%` }}
            />
            <div
              className="absolute rounded-lg border border-white/10 bg-[#2b2b36] px-2 py-1.5 text-[11px] leading-4"
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
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-[#1a6bff] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px]">Vulnerability</h2>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25">
          <Arrow />
        </span>
      </div>
      <p className="mt-4 text-[14px] leading-5 text-white/90">
        Encryption ensures supplier data remains consistently secure from breaches
      </p>
      <div className="absolute inset-x-5 bottom-4 h-[120px]">
        <div className="absolute inset-x-2 bottom-0 h-14 rounded-xl bg-white/20" />
        <div className="absolute inset-x-0 top-[50px] flex h-[48px] -rotate-[3deg] items-start justify-between rounded-xl bg-[#d6e4ff] px-3 pt-2.5 text-[14px] text-[#1c1c24] shadow-lg">
          <span>Thread</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1c1c24] text-[11px] text-white">1</span>
        </div>
        <div className="absolute inset-x-0 top-0 flex h-[54px] -rotate-[3deg] items-center justify-between rounded-xl bg-white px-3 text-[14px] text-[#1c1c24] shadow-lg">
          <span>Priority</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1c1c24] text-[11px] text-white">3</span>
        </div>
      </div>
    </div>
  );
}

function ActiveIncidents() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-light">Active incidents</h2>
        <div className="flex gap-2 text-[11px]">
          {["Newest", "All"].map((t) => (
            <span key={t} className="flex items-center gap-4 rounded-full border border-white/10 px-3 py-2">
              {t}
              <Icon d="M6 9l6 6 6-6" className="h-3 w-3" />
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 items-end gap-3">
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
            tagCls: "bg-[#3d3df5] text-white",
            text: "High error rate in user service and issues",
            name: "Elizabeth Belle",
            email: "eliebelle@gmail.com",
          },
        ].map((c) => (
          <div key={c.name} className="rounded-2xl border border-white/10 bg-[#23232c] p-3.5">
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

function Statistics() {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-light">Statistics</h2>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#23232c]">
          <Arrow />
        </span>
      </div>
      <div className="relative mx-auto mt-2 h-[190px] w-[210px]">
        <div className={`absolute right-[25px] top-0 flex h-[70px] w-[70px] flex-col items-center justify-center rounded-full bg-[#33333f] text-white/80 ${hatch}`}>
          <span className="text-[18px] font-light leading-none">15%</span>
          <span className="mt-0.5 text-[9px]">Fixing</span>
        </div>
        <div className="absolute left-0 top-[12px] flex h-[134px] w-[134px] flex-col items-center justify-center rounded-full bg-[#e5397f]">
          <span className="text-[36px] font-light leading-none">64%</span>
          <span className="mt-0.5 text-[13px]">Investigating</span>
        </div>
        <div className="absolute bottom-0 right-[-2px] flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-[#3d3df5]">
          <span className="text-[24px] font-light leading-none">26%</span>
          <span className="mt-0.5 text-[11px]">Triage</span>
        </div>
      </div>
      {/* page curl */}
      <div className="absolute -bottom-1 left-0 h-9 w-16 [clip-path:polygon(0_0,100%_100%,0_100%)] bg-gradient-to-br from-[#2b2b36] to-[#0e0e12]" />
    </Card>
  );
}

function Assistant() {
  const actions = [
    { label: "Text assistance", c: "text-amber-300", d: "M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" },
    { label: "Automation", c: "text-pink-400", d: "M9 8l-4 4 4 4M15 8l4 4-4 4" },
    { label: "Scheduling", c: "text-sky-300", d: "M5 7h14v13H5zM5 11h14M9 4v4M15 4v4" },
    { label: "Smart response", c: "text-violet-300", d: "M5 5h14v10H9l-4 4V5z" },
  ];
  return (
    <Card className="p-5">
      <div className="text-[17px] font-light">Hi, User 👋</div>
      <div className="mt-0.5 text-[17px]">How can I help you?</div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <div key={a.label} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#23232c] px-3.5 py-3.5 text-[12px]">
            <Icon d={a.d} className={`h-4 w-4 ${a.c}`} />
            {a.label}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-full border border-white/10 bg-[#2b2b36] px-4 py-2.5 text-[12px] text-white/70">
        Ask something...
        <span className="text-violet-300">✦</span>
      </div>
    </Card>
  );
}

export {
  SummaryAndChart,
  Vulnerability,
  ActiveIncidents,
  Statistics,
  Assistant,
};