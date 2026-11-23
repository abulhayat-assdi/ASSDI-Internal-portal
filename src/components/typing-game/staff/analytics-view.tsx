/**
 * Learning analytics from the new data: how far students got in the course,
 * how fast they type, and which games they play. Server component.
 */
import { LEVELS } from "@/lib/typing-game/curriculum";
import { levelLessons } from "@/lib/typing-game/curriculum/progress";
import { findArcadeGame } from "@/lib/typing-game/arcade/catalog";
import type { Insights } from "@/lib/typing-game/server/insights";
import { Empty, Panel } from "./blocks";

function HBar({ label, sub, value, max, color = "var(--tap-primary-500)" }: { label: string; sub?: string; value: number; max: number; color?: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-3 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-semibold">{label}</span>
        {sub ? <span className="block truncate text-xs text-ink-faint">{sub}</span> : null}
      </span>
      <span className="sc-meter h-2.5" aria-hidden="true">
        <span style={{ width: `${max ? (100 * value) / max : 0}%`, background: color }} />
      </span>
      <span className="text-right font-bold tabular-nums">{value}</span>
    </li>
  );
}

export function AnalyticsView({ ins }: { ins: Insights }) {
  const students = ins.totals.students;
  const byLevel = new Map(ins.levels.map((l) => [l.levelId, l]));
  const levels = LEVELS.map((lv) => ({ lv, total: levelLessons(lv).length, row: byLevel.get(lv.id) }));
  const b = ins.wpmBuckets;
  const buckets = [
    { label: "Under 20", value: b.lt20, color: "#f43f5e" },
    { label: "20–29", value: b.w20, color: "#f59e0b" },
    { label: "30–39", value: b.w30, color: "#0ea5e9" },
    { label: "40–49", value: b.w40, color: "#6366f1" },
    { label: "50+", value: b.w50, color: "#10b981" },
  ];
  const tested = students - b.none;
  const maxBucket = Math.max(1, ...buckets.map((x) => x.value));
  const maxGame = Math.max(1, ...ins.games.map((g) => g.plays));

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Course progress" desc={`প্রতিটা লেভেলে অন্তত একটা লেসন শেষ করেছে কতজন (মোট স্টুডেন্ট ${students})`}>
        <ul className="flex flex-col gap-2.5">
          {levels.map(({ lv, total, row }) => (
            <HBar
              key={lv.id}
              label={`${lv.mode === "bn" ? "Bangla " : ""}L${lv.number} · ${lv.title}`}
              sub={row ? `${row.completions} lessons completed · ${total} in level` : `${total} lessons`}
              value={row?.students ?? 0}
              max={Math.max(1, students)}
              color={lv.mode === "bn" ? "#0d9488" : "var(--tap-primary-500)"}
            />
          ))}
        </ul>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Typing speed" desc={`গত ৩০ দিনের টেস্টে প্রত্যেকের সেরা WPM · ${tested} জন টেস্ট দিয়েছে, ${b.none} জন দেয়নি`}>
          {tested === 0 ? (
            <Empty>গত ৩০ দিনে কেউ টাইপিং টেস্ট দেয়নি।</Empty>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {buckets.map((x) => (
                <HBar key={x.label} label={`${x.label} wpm`} value={x.value} max={maxBucket} color={x.color} />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Popular games" desc="গত ৩০ দিনে Typing Arcade-এ কোন গেম কতবার খেলা হয়েছে">
          {ins.games.length === 0 ? (
            <Empty>গত ৩০ দিনে কেউ গেম খেলেনি।</Empty>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {ins.games.map((g) => (
                <HBar
                  key={g.slug}
                  label={findArcadeGame(g.slug)?.title ?? g.slug}
                  sub={`${g.players} players · best score ${g.best.toLocaleString("en-US")}`}
                  value={g.plays}
                  max={maxGame}
                  color="#db2777"
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
