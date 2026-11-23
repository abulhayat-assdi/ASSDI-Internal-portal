/**
 * Small single-series SVG charts for the Progress page. One hue (the
 * primary), thin marks, recessive axes, native hover titles on every mark;
 * text stays in ink colours, never the series colour.
 */

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayName = (iso: string) => DAY[new Date(`${iso}T12:00:00Z`).getUTCDay()];

/** Typing minutes per day with the daily goal as a dashed reference line. */
export function MinutesChart({ days, goal }: { days: { day: string; minutes: number }[]; goal: number }) {
  const W = 560;
  const H = 180;
  const padL = 30;
  const padB = 26;
  const padT = 16;
  const max = Math.max(goal, ...days.map((d) => d.minutes), 5);
  const plotH = H - padB - padT;
  const slot = (W - padL) / days.length;
  const barW = Math.min(26, slot - 6);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const goalY = y(goal);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" role="img" aria-label="Typing minutes per day, last 14 days">
      {[0, Math.round(max / 2), max].map((v) => (
        <g key={v}>
          <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="var(--tap-border)" strokeWidth={1} />
          <text x={padL - 6} y={y(v) + 4} fontSize="10" textAnchor="end" fill="var(--tap-ink-faint)">
            {v}
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = padL + i * slot + (slot - barW) / 2;
        const top = y(d.minutes);
        const h = Math.max(0, padT + plotH - top);
        const today = i === days.length - 1;
        return (
          <g key={d.day}>
            <title>{`${d.day} (${dayName(d.day)}): ${d.minutes} min${d.minutes >= goal ? " — goal reached" : ""}`}</title>
            {/* Wide invisible hit target for the hover title. */}
            <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent" />
            {h > 0 ? (
              <path
                d={`M${x},${top + h} V${top + Math.min(4, h)} Q${x},${top} ${x + Math.min(4, h)},${top} H${x + barW - Math.min(4, h)} Q${x + barW},${top} ${x + barW},${top + Math.min(4, h)} V${top + h} Z`}
                fill="var(--tap-primary-500)"
                opacity={today ? 1 : 0.75}
              />
            ) : null}
            <text x={x + barW / 2} y={H - 8} fontSize="10" textAnchor="middle" fill={today ? "var(--tap-ink)" : "var(--tap-ink-faint)"} fontWeight={today ? 700 : 400}>
              {today ? "Today" : dayName(d.day)}
            </text>
            {today && d.minutes > 0 ? (
              <text x={x + barW / 2} y={top - 5} fontSize="11" textAnchor="middle" fill="var(--tap-ink)" fontWeight={700}>
                {d.minutes}
              </text>
            ) : null}
          </g>
        );
      })}
      <line x1={padL} x2={W} y1={goalY} y2={goalY} stroke="var(--tap-ink-muted)" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={W - 2} y={goalY - 5} fontSize="10" textAnchor="end" fill="var(--tap-ink-muted)">
        Goal {goal} min
      </text>
    </svg>
  );
}

/** Typing-test speed over time (one series: WPM). */
export function SpeedChart({ points }: { points: { wpm: number; accuracy: number; at: string; title: string }[] }) {
  const W = 560;
  const H = 180;
  const padL = 30;
  const padR = 40;
  const padB = 22;
  const padT = 18;
  const max = Math.max(10, ...points.map((p) => p.wpm)) * 1.15;
  const plotH = H - padB - padT;
  const step = points.length > 1 ? (W - padL - padR) / (points.length - 1) : 0;
  const x = (i: number) => padL + i * step;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const best = points.reduce((b, p, i) => (p.wpm > points[b].wpm ? i : b), 0);
  const last = points.length - 1;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.wpm).toFixed(1)}`).join(" ");
  const ticks = [0, Math.round(max / 2), Math.round(max)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" role="img" aria-label="Typing test speed over time">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--tap-border)" strokeWidth={1} />
          <text x={padL - 6} y={y(v) + 4} fontSize="10" textAnchor="end" fill="var(--tap-ink-faint)">
            {v}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--tap-primary-500)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <title>{`${p.title} · ${new Date(p.at).toLocaleDateString("en-GB")}: ${Math.round(p.wpm)} wpm, ${Math.round(p.accuracy)}%`}</title>
          <circle cx={x(i)} cy={y(p.wpm)} r={12} fill="transparent" />
          <circle cx={x(i)} cy={y(p.wpm)} r={4} fill="var(--tap-primary-500)" stroke="var(--tap-surface-solid)" strokeWidth={2} />
        </g>
      ))}
      {[best, last]
        .filter((i, k, a) => a.indexOf(i) === k)
        .map((i) => (
          <text key={i} x={Math.min(x(i) + 8, W - 4)} y={y(points[i].wpm) - 8} fontSize="11" fontWeight={700} fill="var(--tap-ink)" textAnchor={i === last ? "end" : "start"}>
            {i === best ? `Best ${Math.round(points[i].wpm)}` : `${Math.round(points[i].wpm)}`}
          </text>
        ))}
      <text x={padL} y={H - 4} fontSize="10" fill="var(--tap-ink-faint)">
        First test
      </text>
      <text x={W - padR} y={H - 4} fontSize="10" textAnchor="end" fill="var(--tap-ink-faint)">
        Latest
      </text>
    </svg>
  );
}
