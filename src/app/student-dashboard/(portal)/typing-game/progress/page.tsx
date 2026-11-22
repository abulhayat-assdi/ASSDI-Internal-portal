import Link from "next/link";
import { ArrowRight, Award, BookOpen, Clock, Gamepad2, GraduationCap, Medal, Star, Target, Timer, Trophy, Zap } from "lucide-react";
import { Card, CardContent, EmptyState, PageHeader, ProgressBar, SectionHeader } from "@/components/typing-game/ui";
import { DEFAULT_LOCALE, getTranslator } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { getProgressData } from "@/lib/typing-game/server/student";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { loadProgressOverview, type ActivityItem, type LevelSummary } from "@/lib/typing-game/server/progress-overview";
import { MinutesChart, SpeedChart } from "@/components/typing-game/progress/progress-charts";

const LESSONS = "/student-dashboard/typing-game/lessons";

function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} মিনিট`;
  return `${Math.floor(m / 60)} ঘণ্টা ${m % 60} মিনিট`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
}

/** Game records grouped per game: one row each, the common metrics as columns. */
interface GameRow {
  slug: string;
  score: number | null;
  wpm: number | null;
  accuracy: number | null;
}
function groupRecords(records: { gameSlug: string; metric: string; value: number }[]): GameRow[] {
  const by = new Map<string, GameRow>();
  for (const r of records) {
    const row = by.get(r.gameSlug) ?? { slug: r.gameSlug, score: null, wpm: null, accuracy: null };
    if (r.metric === "best_score") row.score = r.value;
    else if (r.metric === "best_wpm") row.wpm = r.value;
    else if (r.metric === "best_accuracy") row.accuracy = r.value;
    by.set(r.gameSlug, row);
  }
  return [...by.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
const cell = (v: number | null, unit = "") => (v === null ? "—" : `${Math.round(v)}${unit}`);

const KIND_ICON: Record<ActivityItem["kind"], typeof Star> = {
  lesson: GraduationCap,
  star: Star,
  test: Timer,
  game: Gamepad2,
  mission: Target,
  other: Award,
};

function Tile({ icon: Icon, label, value, hint, children }: { icon: typeof Star; label: string; value: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="tap-card flex flex-col gap-2 p-4">
      <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {label}
        <Icon className="h-4 w-4" style={{ color: "var(--tap-primary-500)" }} aria-hidden="true" />
      </span>
      <span className="font-display text-2xl font-extrabold leading-tight">{value}</span>
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
      {children}
    </div>
  );
}

function LevelRow({ l }: { l: LevelSummary }) {
  const done = l.completed === l.total;
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <Link href={`${LESSONS}?level=${l.id}`} className="font-semibold hover:underline">
          Level {l.number} · {l.title}
        </Link>
        <span className="flex items-center gap-3 text-xs text-ink-muted">
          <span className="tabular-nums">
            {l.completed}/{l.total} লেসন
          </span>
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <Star className="h-3 w-3" fill="#f59e0b" stroke="#f59e0b" aria-hidden="true" />
            {l.stars}/{l.maxStars}
          </span>
          {l.skipped > 0 ? <span>{l.skipped}টি skip</span> : null}
          {done ? (
            <span className="font-semibold" style={{ color: "var(--tap-success-600, #16a34a)" }}>
              ✓ সম্পূর্ণ
            </span>
          ) : null}
        </span>
      </div>
      <ProgressBar value={l.completed} max={l.total} label={`Level ${l.number}`} />
      {!done && l.nextLessonId && l.completed + l.skipped > 0 ? (
        <Link href={`${LESSONS}/${l.nextLessonId}`} className="tap-link-btn w-fit text-xs">
          চালিয়ে যান: {l.nextLessonTitle} →
        </Link>
      ) : null}
    </li>
  );
}

export default async function ProgressPage() {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "progress");
  const { session, store } = await studentContext(locale);
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  const [o, games] = await Promise.all([loadProgressOverview(client, session.userId), getProgressData(session.userId, store)]);

  if (!games) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState title={t("title")} description={t("noHistory")} />
      </div>
    );
  }

  const r = o.rank;
  const rankPct = r.next === null ? 100 : Math.min(100, Math.round(((r.xp - r.floor) / Math.max(1, r.next - r.floor)) * 100));
  const nextLevel = o.levels.find((l) => l.mode === "en" && l.nextLessonId);
  const enLevels = o.levels.filter((l) => l.mode === "en");
  const bnLevels = o.levels.filter((l) => l.mode === "bn");
  const bnStarted = bnLevels.some((l) => l.completed + l.skipped > 0);
  const bestSpeed = o.bestTest ? Math.round(o.bestTest.wpm) : Math.round(o.lessons.bestWpm);
  const weekMinutes = o.days.slice(-7).reduce((n, d) => n + d.minutes, 0);
  const gameRows = groupRecords(games.records);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="আমার অগ্রগতি" description="কী শিখেছেন, কতটা এগিয়েছেন আর কোথায় উন্নতি হচ্ছে — সব এক জায়গায়।" />

      {/* Headline numbers */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={Trophy} label="র‍্যাঙ্ক" value={`Level ${r.level} · ${r.title}`} hint={r.next === null ? "সর্বোচ্চ র‍্যাঙ্ক!" : `${r.xp} XP · আর ${r.next - r.xp} XP পেলে ${r.nextTitle}`}>
          <ProgressBar value={rankPct} max={100} label="Rank progress" />
        </Tile>
        <Tile icon={BookOpen} label="লেসন সম্পূর্ণ" value={`${o.lessons.completed} / ${o.lessons.total}`} hint={`${o.lessons.stars} / ${o.lessons.maxStars} স্টার · লেসনে মোট ${fmtDuration(o.lessons.timeMs)}`}>
          {nextLevel?.nextLessonId ? (
            <Link href={`${LESSONS}/${nextLevel.nextLessonId}`} className="tap-link-btn inline-flex items-center gap-1 text-xs">
              পরের লেসন: {nextLevel.nextLessonTitle} <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : null}
        </Tile>
        <Tile
          icon={Zap}
          label="সেরা গতি"
          value={bestSpeed > 0 ? `${bestSpeed} wpm` : "—"}
          hint={
            o.bestTest
              ? `${o.bestTest.title} · ${Math.round(o.bestTest.accuracy)}% নির্ভুল`
              : bestSpeed > 0
                ? `লেসনে · সেরা নির্ভুলতা ${Math.round(o.lessons.bestAccuracy)}%`
                : "একটা টেস্ট দিয়ে গতি মাপুন"
          }
        />
        <Tile icon={Clock} label="আজ টাইপ করেছেন" value={`${o.todayMinutes} / ${o.goalMinutes} মিনিট`} hint={`শেষ ৭ দিনে মোট ${weekMinutes} মিনিট`}>
          <ProgressBar value={Math.min(o.todayMinutes, o.goalMinutes)} max={o.goalMinutes} label="Daily goal" />
        </Tile>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* Lessons by level */}
        <Card>
          <CardContent>
            <SectionHeader title="লেভেল অনুযায়ী লেসন" description="প্রতিটা লেভেলে কয়টা লেসন শেষ, কত স্টার, আর পরের লেসন কোনটা।" />
            <ul className="flex flex-col gap-4">
              {enLevels.map((l) => (
                <LevelRow key={l.id} l={l} />
              ))}
            </ul>
            <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--tap-border)" }}>
              <p className="mb-3 text-sm font-bold">বাংলা</p>
              {bnStarted ? (
                <ul className="flex flex-col gap-4">
                  {bnLevels.map((l) => (
                    <LevelRow key={l.id} l={l} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">
                  বাংলা লেসন এখনো শুরু হয়নি। English Level 1-এর Final Assessment শেষ করলে বাংলা খুলে যায়।{" "}
                  <Link href={`${LESSONS}?mode=bn`} className="tap-link-btn">
                    বাংলা লেসন দেখুন
                  </Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent>
              <SectionHeader title="টেস্টে গতি কীভাবে বাড়ছে" description="প্রতিটা টাইপিং টেস্টের WPM, পুরনো থেকে নতুন। বিন্দুর ওপর মাউস রাখলে বিস্তারিত দেখাবে।" />
              {o.tests.length >= 2 ? (
                <SpeedChart points={o.tests} />
              ) : (
                <p className="py-6 text-center text-sm text-ink-muted">
                  গ্রাফ দেখতে অন্তত দুটো টেস্ট দিন।{" "}
                  <Link href="/student-dashboard/typing-game/tests" className="tap-link-btn">
                    টেস্ট দিন
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <SectionHeader title="প্রতিদিনের টাইপিং (শেষ ১৪ দিন)" description="লেসন, টেস্ট আর Practice মিলিয়ে মিনিট। ড্যাশ-রেখা = আপনার দৈনিক লক্ষ্য।" />
              <MinutesChart days={o.days} goal={o.goalMinutes} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* Activity feed */}
        <Card>
          <CardContent>
            <SectionHeader title="সাম্প্রতিক কার্যক্রম" description="কী করেছেন আর তার জন্য কত XP পেয়েছেন।" />
            {o.activity.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("noHistory")}</p>
            ) : (
              <ul className="flex flex-col">
                {o.activity.map((a, i) => {
                  const Icon = KIND_ICON[a.kind];
                  return (
                    <li key={i} className="flex items-center gap-3 border-b py-2 text-sm last:border-b-0" style={{ borderColor: "var(--tap-border)" }}>
                      <Icon className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate" title={a.label}>
                        {a.label}
                      </span>
                      <span className="shrink-0 text-xs text-ink-faint">{fmtWhen(a.at)}</span>
                      <span className="w-16 shrink-0 text-right font-semibold tabular-nums" style={{ color: "var(--tap-primary-600)" }}>
                        +{a.xp} XP
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Games */}
        <Card>
          <CardContent>
            <SectionHeader title="গেমে সেরা রেকর্ড" description="প্রতিটা গেমে আপনার সেরা ফল।" />
            {gameRows.length === 0 ? (
              <p className="text-sm text-ink-muted">
                এখনো কোনো গেম খেলেননি।{" "}
                <Link href="/student-dashboard/typing-game/games" className="tap-link-btn">
                  গেম খেলুন
                </Link>
              </p>
            ) : (
              <table className="tap-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">গেম</th>
                    <th className="text-right" style={{ textAlign: "right" }}>সেরা স্কোর</th>
                    <th className="text-right" style={{ textAlign: "right" }}>সেরা গতি</th>
                    <th className="text-right" style={{ textAlign: "right" }}>নির্ভুলতা</th>
                  </tr>
                </thead>
                <tbody>
                  {gameRows.map((g) => (
                    <tr key={g.slug}>
                      <td className="capitalize">{g.slug.replace(/-/g, " ")}</td>
                      <td className="text-right font-semibold tabular-nums">{cell(g.score)}</td>
                      <td className="text-right tabular-nums">{cell(g.wpm, " wpm")}</td>
                      <td className="text-right tabular-nums">{cell(g.accuracy, "%")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {games.achievements.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  <Medal className="h-4 w-4" aria-hidden="true" /> অর্জন
                </p>
                <div className="flex flex-wrap gap-2">
                  {games.achievements.map((a) => (
                    <span key={a.slug} className="tap-badge tap-badge-primary">
                      {a.name} · {Math.round(a.value)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
