/** Card illustrations for the arcade games (simple SVG scenes). */
import type { ArcadeSlug } from "@/lib/typing-game/arcade/catalog";

const W = 320;
const H = 180;

function Word({ x, y, text, typed = 0 }: { x: number; y: number; text: string; typed?: number }) {
  const w = text.length * 9.6 + 14;
  return (
    <g>
      <rect x={x - w / 2} y={y - 11} width={w} height={22} rx={11} fill="rgba(15,23,42,0.8)" />
      <text x={x} y={y + 5} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="15" fontWeight="700">
        <tspan fill="#4ade80">{text.slice(0, typed)}</tspan>
        <tspan fill="#fff">{text.slice(typed)}</tspan>
      </text>
    </g>
  );
}

export function GameArt({ slug }: { slug: ArcadeSlug }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {ART[slug]}
    </svg>
  );
}

const stars = Array.from({ length: 30 }, (_, i) => (
  <circle key={i} cx={(i * 97) % W} cy={(i * 53) % 120} r={i % 3 === 0 ? 1.4 : 0.8} fill="#fff" opacity={0.7} />
));

const ART: Record<ArcadeSlug, React.ReactNode> = {
  "meteor-shield": (
    <>
      <defs>
        <linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060818" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
        <radialGradient id="ms-rock">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.45" stopColor="#f97316" />
          <stop offset="1" stopColor="#7c2d12" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#ms-sky)" />
      {stars}
      <path d="M0 150 h20 v-25 h18 v25 h14 v-40 h20 v40 h16 v-18 h22 v18 h12 v-34 h18 v34 h20 v-22 h16 v22 h24 v-30 h20 v30 h18 v-16 h22 v16 h40 v30 H0z" fill="#170b3b" />
      <ellipse cx={160} cy={160} rx={175} ry={40} fill="none" stroke="#38bdf8" strokeOpacity={0.6} strokeWidth={2.5} />
      {[
        [80, 50, 13],
        [215, 80, 17],
        [255, 30, 10],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <path d={`M${x - r * 0.7} ${y} L${x + r * 0.7} ${y} L${x} ${y - 50}z`} fill="#fb923c" opacity={0.5} />
          <circle cx={x} cy={y} r={r} fill="url(#ms-rock)" />
        </g>
      ))}
      <Word x={215} y={112} text="planet" typed={3} />
      <Word x={80} y={80} text="star" />
      <line x1={160} y1={150} x2={215} y2={80} stroke="#fde047" strokeDasharray="5 4" strokeWidth={2} />
    </>
  ),
  "bubble-burst": (
    <>
      <defs>
        <linearGradient id="bb-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#082f49" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <radialGradient id="bb-b" cx="0.35" cy="0.35">
          <stop offset="0" stopColor="#fff" stopOpacity={0.8} />
          <stop offset="1" stopColor="#22d3ee" stopOpacity={0.25} />
        </radialGradient>
        <radialGradient id="bb-g" cx="0.35" cy="0.35">
          <stop offset="0" stopColor="#fef08a" />
          <stop offset="1" stopColor="#ca8a04" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#bb-sea)" />
      <line x1={0} y1={14} x2={W} y2={14} stroke="#f43f5e" strokeDasharray="8 6" strokeWidth={2} />
      {[
        [60, 120, 26, "k", "bb-b"],
        [150, 70, 34, "fish", "bb-g"],
        [245, 115, 30, "wave", "bb-b"],
        [270, 45, 20, "j", "bb-b"],
      ].map(([x, y, r, t, f], i) => (
        <g key={i}>
          <circle cx={x as number} cy={y as number} r={r as number} fill={`url(#${f})`} stroke="#fff" strokeOpacity={0.7} strokeWidth={2} />
          <text x={x as number} y={(y as number) + 6} textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight={800} fontSize={18} fill="#0f172a">
            {t as string}
          </text>
        </g>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={(i * 41) % W} cy={170 - ((i * 37) % 150)} r={2 + (i % 3)} fill="#fff" opacity={0.25} />
      ))}
    </>
  ),
  "runner-rush": (
    <>
      <defs>
        <linearGradient id="rr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fb923c" />
          <stop offset="1" stopColor="#fef3c7" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#rr-sky)" />
      <circle cx={250} cy={50} r={26} fill="#fef3c7" />
      <path d="M0 120 Q60 80 120 115 T240 105 T320 110 V140 H0z" fill="#c2410c" />
      <rect y={140} width={W} height={40} fill="#422006" />
      <g stroke="#1e293b" strokeWidth={5} strokeLinecap="round">
        <line x1={70} y1={115} x2={60} y2={140} />
        <line x1={70} y1={115} x2={82} y2={138} />
        <line x1={70} y1={115} x2={72} y2={92} />
        <line x1={71} y1={98} x2={85} y2={108} />
        <line x1={71} y1={98} x2={58} y2={106} />
      </g>
      <circle cx={74} cy={84} r={8} fill="#1e293b" />
      <rect x={180} y={112} width={30} height={28} fill="#78350f" stroke="#a16207" strokeWidth={2} />
      <rect x={270} y={100} width={10} height={40} fill="#166534" />
      <Word x={195} y={92} text="jump" typed={2} />
      <Word x={275} y={78} text="quick" />
    </>
  ),
  "turbo-racer": (
    <>
      <rect width={W} height={H} fill="#14532d" />
      <rect y={30} width={W} height={120} fill="#374151" />
      {[60, 90, 120].map((y) => (
        <line key={y} x1={0} y1={y} x2={W} y2={y} stroke="#fff" strokeOpacity={0.5} strokeDasharray="14 10" strokeWidth={2} />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={290 + (i % 2) * 8} y={30 + Math.floor(i / 2) * 20} width={8} height={10} fill={i % 2 ? "#fff" : "#111"} />
      ))}
      {[
        [210, 45, "#ef4444"],
        [150, 75, "#3b82f6"],
        [175, 105, "#a855f7"],
        [120, 135, "#f59e0b"],
      ].map(([x, y, c], i) => (
        <g key={i}>
          <rect x={(x as number) - 26} y={(y as number) - 9} width={52} height={18} rx={7} fill={c as string} />
          <circle cx={(x as number) - 15} cy={(y as number) + 9} r={5} fill="#111" />
          <circle cx={(x as number) + 15} cy={(y as number) + 9} r={5} fill="#111" />
        </g>
      ))}
      <text x={210} y={50} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fde047">
        YOU
      </text>
      <rect x={10} y={156} width={300} height={20} rx={6} fill="rgba(15,23,42,0.85)" />
      <text x={20} y={170} fontFamily="ui-monospace, monospace" fontSize={12} fill="#fff">
        <tspan fill="#4ade80">The race is </tspan>on, keep your eyes forward.
      </text>
    </>
  ),
  "combo-blitz": (
    <>
      <defs>
        <linearGradient id="cb-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e0b33" />
          <stop offset="1" stopColor="#831843" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#cb-bg)" />
      {[30, 55, 80].map((r) => (
        <circle key={r} cx={160} cy={70} r={r} fill="none" stroke="#f472b6" strokeOpacity={0.35 - r / 400} strokeWidth={3} />
      ))}
      <circle cx={160} cy={70} r={40} fill="none" stroke="#f472b6" strokeWidth={7} strokeDasharray="190 300" strokeLinecap="round" transform="rotate(-90 160 70)" />
      <text x={160} y={84} textAnchor="middle" fontSize={40} fontWeight={900} fill="#fff">
        x6
      </text>
      <rect x={20} y={130} width={280} height={34} rx={12} fill="rgba(15,23,42,0.85)" />
      <text x={160} y={153} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={16} fontWeight={700} fill="#e2e8f0">
        <tspan fill="#4ade80">fast hands </tspan>
        <tspan fill="#fde047">w</tspan>in the game
      </text>
    </>
  ),
  "bomb-squad": (
    <>
      <rect width={W} height={H} fill="#27272a" />
      {Array.from({ length: 18 }, (_, i) => (
        <path key={i} d={`M${i * 20 - 10} 180 l10 -14 h10 l-10 14z`} fill="#eab308" />
      ))}
      <circle cx={110} cy={85} r={48} fill="#09090b" stroke="#52525b" strokeWidth={3} />
      <rect x={100} y={28} width={20} height={14} fill="#3f3f46" />
      <path d="M110 30 Q130 10 150 18" stroke="#a8a29e" strokeWidth={4} fill="none" />
      <circle cx={152} cy={17} r={6} fill="#f97316" />
      <circle cx={152} cy={17} r={3} fill="#fde047" />
      <rect x={80} y={74} width={60} height={22} rx={4} fill="#000" />
      <text x={110} y={90} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={14} fontWeight={800} fill="#ef4444">
        03.2
      </text>
      <rect x={175} y={66} width={125} height={40} rx={8} fill="#000" stroke="#eab308" strokeWidth={2} />
      <text x={237} y={93} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={19} fontWeight={800} fill="#a1a1aa">
        <tspan fill="#4ade80">7K#</tspan>q-2!
      </text>
    </>
  ),
  "lava-climb": (
    <>
      <defs>
        <linearGradient id="lc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1917" />
          <stop offset="1" stopColor="#7c2d12" />
        </linearGradient>
        <linearGradient id="lc-lava" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde047" />
          <stop offset="0.3" stopColor="#f97316" />
          <stop offset="1" stopColor="#7f1d1d" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#lc-bg)" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={120} y={140 - i * 20} width={80} height={18} rx={3} fill={`hsl(${i * 47},55%,48%)`} />
      ))}
      <circle cx={160} cy={10} r={7} fill="#0f172a" />
      <rect x={154} y={16} width={12} height={4} fill="#facc15" />
      <path d="M0 150 Q40 140 80 150 T160 148 T240 150 T320 146 V180 H0z" fill="url(#lc-lava)" />
      <Word x={255} y={40} text="castle" typed={4} />
    </>
  ),
  "dragon-keep": (
    <>
      <defs>
        <linearGradient id="dk-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="1" stopColor="#3f6212" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#dk-bg)" />
      {stars}
      <rect y={130} width={W} height={50} fill="#1f2937" />
      {Array.from({ length: 11 }, (_, i) => (
        <rect key={i} x={i * 30} y={120} width={18} height={12} fill="#1f2937" />
      ))}
      <path d="M170 60 L215 15 L230 70z M290 60 L245 15 L235 70z" fill="#15803d" />
      <ellipse cx={232} cy={85} rx={45} ry={30} fill="#15803d" />
      <ellipse cx={180} cy={68} rx={24} ry={16} fill="#15803d" transform="rotate(-15 180 68)" />
      <circle cx={172} cy={63} r={4} fill="#fde047" />
      <path d="M160 72 L60 95 L60 112z" fill="#f97316" opacity={0.85} />
      <circle cx={45} cy={95} r={9} fill="#e2e8f0" />
      <path d="M35 125 L55 125 L50 104 L40 104z" fill="#3b82f6" />
      <rect x={200} y={20} width={110} height={10} rx={5} fill="rgba(0,0,0,0.5)" />
      <rect x={200} y={20} width={70} height={10} rx={5} fill="#a855f7" />
      <rect x={10} y={146} width={300} height={24} rx={6} fill="rgba(15,23,42,0.85)" />
      <text x={20} y={163} fontFamily="ui-monospace, monospace" fontSize={12} fill="#e2e8f0">
        <tspan fill="#4ade80">Fire falls </tspan>from the darkened sky.
      </text>
    </>
  ),
};
