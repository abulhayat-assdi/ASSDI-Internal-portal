"use client";

import { useState } from "react";

const BN_DAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"];

/**
 * Typing minutes per day (one series, so no legend): thin bars on a quiet
 * baseline, a label on the latest day, and a hover/focus tooltip per bar.
 */
export function ActivityChart({ days }: { days: { day: string; minutes: number; active: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(10, ...days.map((d) => d.minutes));
  const W = 560;
  const H = 130;
  const top = 18;
  const base = H - 22;
  const slot = W / Math.max(1, days.length);
  const bw = Math.min(26, slot - 6);
  const h = (m: number) => (m <= 0 ? 0 : Math.max(3, ((base - top) * m) / max));
  const last = days.length - 1;
  const shown = hover ?? last;
  const d = days[shown];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-[2.75rem] items-end justify-between gap-3">
        {d ? (
          <p className="text-sm">
            <span className="font-display text-2xl font-extrabold tabular-nums">{d.minutes}</span>{" "}
            <span className="text-ink-muted">মিনিট টাইপ · {d.active} জন স্টুডেন্ট</span>
            <span className="block text-xs text-ink-faint">
              {shown === last ? "আজ" : `${BN_DAYS[new Date(d.day).getUTCDay()]}, ${d.day.slice(5).replace("-", "/")}`}
            </span>
          </p>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="গত ১৪ দিনের টাইপিং মিনিট">
        {[0.5, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={base - (base - top) * f} y2={base - (base - top) * f} stroke="var(--tap-border)" strokeDasharray="3 4" />
        ))}
        <text x={W} y={top - 6} textAnchor="end" fontSize="10" fill="var(--tap-ink-faint)">
          {max} মি.
        </text>
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--tap-border-strong)" />
        {days.map((x, i) => {
          const cx = i * slot + slot / 2;
          const bh = h(x.minutes);
          const on = i === shown;
          return (
            <g
              key={x.day}
              tabIndex={0}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              style={{ outline: "none", cursor: "default" }}
            >
              <title>{`${x.day}: ${x.minutes} মিনিট, ${x.active} জন`}</title>
              <rect x={i * slot} y={top} width={slot} height={base - top + 20} fill="transparent" />
              {bh > 0 ? (
                <path
                  d={`M${cx - bw / 2},${base} v${-(bh - 4)} a4,4 0 0 1 4,-4 h${bw - 8} a4,4 0 0 1 4,4 v${bh - 4} z`}
                  fill={on ? "var(--tap-primary-600)" : "var(--tap-primary-300)"}
                />
              ) : (
                <rect x={cx - bw / 2} y={base - 2} width={bw} height={2} rx={1} fill="var(--tap-border-strong)" />
              )}
              {i % 2 === last % 2 ? (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill={on ? "var(--tap-ink)" : "var(--tap-ink-faint)"}>
                  {i === last ? "আজ" : x.day.slice(8)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
