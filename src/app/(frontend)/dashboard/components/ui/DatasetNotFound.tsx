import Link from "next/link";

function ConfusedDragon() {
  return (
    <svg viewBox="0 0 240 200" className="h-44 w-auto" role="img" aria-label="A confused little dragon">
      {/* floating question marks */}
      <g className="animate-pulse" fill="currentColor" fontFamily="ui-rounded, system-ui, sans-serif" fontWeight="700">
        <text x="150" y="38" fontSize="34" className="text-amber-400" fill="#fbbf24">?</text>
        <text x="182" y="62" fontSize="20" fill="#fbbf24" opacity="0.7">?</text>
        <text x="56" y="30" fontSize="16" fill="#fbbf24" opacity="0.5">?</text>
      </g>

      {/* tail */}
      <path
        d="M146 150 C190 150 214 140 208 112 C205 98 192 100 194 112 C196 124 186 134 160 134"
        fill="none" stroke="#059669" strokeWidth="14" strokeLinecap="round"
      />
      <path d="M208 100 l12 6 l-14 6 z" fill="#fbbf24" />

      {/* wings */}
      <path d="M72 112 C40 84 30 100 26 120 C42 114 52 124 60 134 Z" fill="#34d399" stroke="#047857" strokeWidth="3" strokeLinejoin="round" />
      <path d="M134 112 C166 84 176 100 180 120 C164 114 154 124 146 134 Z" fill="#34d399" stroke="#047857" strokeWidth="3" strokeLinejoin="round" />

      {/* back spikes */}
      <g fill="#fbbf24" stroke="#d97706" strokeWidth="2" strokeLinejoin="round">
        <path d="M96 100 l6 -12 l6 12 z" />
        <path d="M112 98 l6 -12 l6 12 z" />
      </g>

      {/* body */}
      <ellipse cx="104" cy="144" rx="52" ry="38" fill="#6ee7b7" stroke="#047857" strokeWidth="3.5" />
      <ellipse cx="104" cy="152" rx="30" ry="26" fill="#d1fae5" />
      <g stroke="#a7f3d0" strokeWidth="3" strokeLinecap="round">
        <path d="M86 142 h36" /><path d="M84 154 h40" /><path d="M88 166 h32" />
      </g>

      {/* feet */}
      <ellipse cx="78" cy="180" rx="16" ry="9" fill="#34d399" stroke="#047857" strokeWidth="3" />
      <ellipse cx="130" cy="180" rx="16" ry="9" fill="#34d399" stroke="#047857" strokeWidth="3" />

      {/* head (slightly tilted, like it's thinking) */}
      <g transform="rotate(-8 104 80)">
        {/* horns */}
        <path d="M76 52 L68 26 L90 44 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="3" strokeLinejoin="round" />
        <path d="M132 52 L140 26 L118 44 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="3" strokeLinejoin="round" />
        {/* ears */}
        <ellipse cx="64" cy="76" rx="8" ry="12" fill="#34d399" stroke="#047857" strokeWidth="3" />
        <ellipse cx="144" cy="76" rx="8" ry="12" fill="#34d399" stroke="#047857" strokeWidth="3" />
        {/* face */}
        <ellipse cx="104" cy="80" rx="42" ry="36" fill="#6ee7b7" stroke="#047857" strokeWidth="3.5" />
        {/* snout */}
        <ellipse cx="104" cy="94" rx="22" ry="15" fill="#a7f3d0" stroke="#047857" strokeWidth="2.5" />
        <circle cx="96" cy="90" r="2.6" fill="#047857" />
        <circle cx="112" cy="90" r="2.6" fill="#047857" />
        {/* eyes: one big, one small */}
        <circle cx="84" cy="70" r="11" fill="#fff" stroke="#047857" strokeWidth="2.5" />
        <circle cx="87" cy="67" r="4.5" fill="#0f172a" />
        <circle cx="126" cy="72" r="8" fill="#fff" stroke="#047857" strokeWidth="2.5" />
        <circle cx="123" cy="75" r="3.5" fill="#0f172a" />
        {/* eyebrows: one raised, one worried */}
        <path d="M72 52 Q84 44 96 52" fill="none" stroke="#047857" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M116 62 L134 66" fill="none" stroke="#047857" strokeWidth="3.5" strokeLinecap="round" />
        {/* wobbly mouth */}
        <path d="M94 104 q5 -5 10 0 t10 0" fill="none" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
        {/* sweat drop */}
        <path d="M150 52 q6 10 0 14 q-6 -4 0 -14 z" fill="#7dd3fc" stroke="#0284c7" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

export function DatasetNotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <ConfusedDragon />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Woah, we couldn&apos;t find that dataset!</h1>
        <p className="mx-auto max-w-sm text-sm opacity-70">
          Our dragon searched the whole hoard and came up empty. Maybe it moved, or the link is off.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition hover:bg-current/10"
      >
        ← Back home
      </Link>
    </div>
  );
}

