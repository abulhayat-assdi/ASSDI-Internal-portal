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
        <Kpi icon={Trophy} label="লেভেল · XP" value={p.profile?.level ?? "—"} hint={`${p.profile?.xp ?? 0} XP · ${p.profile?.coins ?? 0} কয়েন`} tone="amber" />
        <Kpi icon={BookOpenCheck} label="লেসন শেষ" value={done} tone="violet" />
        <Kpi icon={Gauge} label="সেরা টেস্ট WPM" value={bestTest || "—"} hint={p.tests[0] ? `শেষ টেস্টে নির্ভুলতা ${p.tests[0].accuracy}%` : "এখনো টেস্ট দেয়নি"} tone="indigo" />
        <Kpi icon={Clock3} label="মোট টাইপ" value={`${p.minutesTotal} মি.`} hint={`শেষ টাইপ ${daysAgo(p.lastDay, p.today)}`} tone="sky" />
        <Kpi
          icon={Swords}
          label="কম্পিটিশন"
          value={`${p.challenges.wins}/${p.challenges.played}`}
          hint={p.challenges.played ? `জয় / খেলা · ${p.challenges.draws} ড্র` : "এখনো খেলেনি"}
          tone="rose"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="দৈনিক টাইপিং" desc="গত ১৪ দিন">
          <ActivityChart days={p.days} />
        </Panel>
        <Panel title="লেভেল অনুযায়ী লেসন">
          <ul className="flex flex-col gap-2.5">
            {started.map((lv) => {
              const total = levelLessons(lv).length;
              const row = byLevel.get(lv.id);
              const pct = total ? Math.round((100 * (row?.done ?? 0)) / total) : 0;
              return (
                <li key={lv.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">
                      {lv.mode === "bn" ? "বাংলা " : ""}L{lv.number} · {lv.title}
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
        <Panel title="সাম্প্রতিক টেস্ট">
          {p.tests.length === 0 ? (
            <Empty>এখনো কোনো টাইপিং টেস্ট দেয়নি।</Empty>
          ) : (
            <table className="tap-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">টেস্ট</th>
                  <th className="text-right">WPM</th>
                  <th className="text-right">নির্ভুলতা</th>
                  <th className="text-right">তারিখ</th>
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
        <Panel title="গেম">
          {p.games.length === 0 ? (
            <Empty>এখনো কোনো গেম খেলেনি।</Empty>
          ) : (
            <table className="tap-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">গেম</th>
                  <th className="text-right">খেলেছে</th>
                  <th className="text-right">সেরা স্কোর</th>
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
