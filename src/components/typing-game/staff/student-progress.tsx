/** One student's learning picture for staff pages (admin and teacher). Server component. */
import { BookOpenCheck, Clock3, Gauge, Swords, Trophy } from "lucide-react";
import { LEVELS } from "@/lib/typing-game/curriculum";
import { levelLessons } from "@/lib/typing-game/curriculum/progress";
import { findTest } from "@/lib/typing-game/tests/catalog";
import { findArcadeGame } from "@/lib/typing-game/arcade/catalog";
import { daysAgo, type StaffStudentProgress } from "@/lib/typing-game/server/insights";
import { ActivityChart } from "./activity-chart";
import { Empty, Kpi, Panel } from "./blocks";

export function StudentProgress({ p }: { p: StaffStudentProgress }) {
  const byLevel = new Map(p.lessons.map((l) => [l.levelId, l]));
  const done = p.lessons.reduce((n, l) => n + l.done, 0);
  const bestTest = p.tests.reduce((b, t) => Math.max(b, t.wpm), 0);
  const started = LEVELS.filter((lv) => byLevel.has(lv.id) || lv.mode === "en");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi icon={Trophy} label="Level · XP" value={p.profile?.level ?? "—"} hint={`${p.profile?.xp ?? 0} XP · ${p.profile?.coins ?? 0} coins`} tone="amber" />
        <Kpi icon={BookOpenCheck} label="Lessons done" value={done} tone="violet" />
        <Kpi icon={Gauge} label="Best test WPM" value={bestTest || "—"} hint={p.tests[0] ? `Last test accuracy ${p.tests[0].accuracy}%` : "No tests yet"} tone="indigo" />
        <Kpi icon={Clock3} label="Total typing" value={`${p.minutesTotal} min`} hint={`Last typed ${daysAgo(p.lastDay, p.today)}`} tone="sky" />
        <Kpi
          icon={Swords}
          label="Competition"
          value={`${p.challenges.wins}/${p.challenges.played}`}
          hint={p.challenges.played ? `Wins / played · ${p.challenges.draws} draws` : "Not played yet"}
          tone="rose"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Daily typing" desc="Last 14 days">
          <ActivityChart days={p.days} />
        </Panel>
        <Panel title="Lessons by level">
          <ul className="flex flex-col gap-2.5">
            {started.map((lv) => {
              const total = levelLessons(lv).length;
              const row = byLevel.get(lv.id);
              const pct = total ? Math.round((100 * (row?.done ?? 0)) / total) : 0;
              return (
                <li key={lv.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">
                      {lv.mode === "bn" ? "Bangla " : ""}L{lv.number} · {lv.title}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                      {row?.done ?? 0}/{total}
                      {row?.stars ? ` · ${row.stars}★` : ""}
                      {row?.skipped ? ` · ${row.skipped} skip` : ""}
                    </span>
                  </div>
                  <span className="sc-meter mt-1 block">
                    <span style={{ width: `${pct}%`, background: pct === 100 ? "#10b981" : undefined }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Recent tests">
          {p.tests.length === 0 ? (
            <Empty>No typing tests yet.</Empty>
          ) : (
            <table className="tap-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Test</th>
                  <th className="text-right">WPM</th>
                  <th className="text-right">Accuracy</th>
                  <th className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {p.tests.map((t) => (
                  <tr key={t.at}>
                    <td>{findTest(t.testId)?.title ?? t.testId}</td>
                    <td className="text-right font-semibold tabular-nums">{t.wpm}</td>
                    <td className="text-right tabular-nums">{t.accuracy}%</td>
                    <td className="text-right text-xs text-ink-faint">{t.at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Games">
          {p.games.length === 0 ? (
            <Empty>No games played yet.</Empty>
          ) : (
            <table className="tap-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Game</th>
                  <th className="text-right">Plays</th>
                  <th className="text-right">Best score</th>
                </tr>
              </thead>
              <tbody>
                {p.games.map((g) => (
                  <tr key={g.slug}>
                    <td>{findArcadeGame(g.slug)?.title ?? g.slug}</td>
                    <td className="text-right tabular-nums">{g.plays}</td>
                    <td className="text-right font-semibold tabular-nums">{g.best.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
