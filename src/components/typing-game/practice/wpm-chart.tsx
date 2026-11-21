/** Per-second WPM line for the practice result (inline SVG, no chart library). */
export function WpmChart({ samples }: { samples: number[] }) {
  const w = 600;
  const h = 120;
  const pad = 24;
  const max = Math.max(10, ...samples);
  const step = samples.length > 1 ? (w - pad * 2) / (samples.length - 1) : 0;
  const pts = samples.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" role="img" aria-label="WPM over time">
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="var(--tap-border-strong)" />
        <text x={pad} y={pad - 8} fontSize="11" fill="var(--tap-ink-faint)">
          {max} wpm
        </text>
        <text x={w - pad} y={h - 6} fontSize="11" textAnchor="end" fill="var(--tap-ink-faint)">
          {samples.length}s
        </text>
        <path d={area} fill="var(--tap-primary-100)" opacity="0.6" />
        <path d={line} fill="none" stroke="var(--tap-primary-500)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    </figure>
  );
}
