import { typingBase } from "@/lib/typing-game/server/base";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, Clock, Gamepad2, GraduationCap, Medal, Star, Target, Timer, Trophy, Zap } from "lucide-react";
import { Card, CardContent, EmptyState, PageHeader, ProgressBar, SectionHeader } from "@/components/typing-game/ui";
import { DEFAULT_LOCALE, getTranslator } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { getProgressData } from "@/lib/typing-game/server/student";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { loadProgressOverview, type ActivityItem, type LevelSummary } from "@/lib/typing-game/server/progress-overview";
import { MinutesChart, SpeedChart } from "@/components/typing-game/progress/progress-charts";
import { createArcadeStore } from "@/lib/typing-game/server/arcade-store";
import { ARCADE_GAMES } from "@/lib/typing-game/arcade/catalog";


function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
}

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

function LevelRow({ l, LESSONS }: { l: LevelSummary; LESSONS: string }) {
  const done = l.completed === l.total;
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <Link href={`${LESSONS}?level=${l.id}`} className="font-semibold hover:underline">
          Level {l.number} · {l.title}
        </Link>
        <span className="flex items-center gap-3 text-xs text-ink-muted">
          <span className="tabular-nums">
            {l.completed}/{l.total} lessons
          </span>
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <Star className="h-3 w-3" fill="#f59e0b" stroke="#f59e0b" aria-hidden="true" />
            {l.stars}/{l.maxStars}
          </span>
          {l.skipped > 0 ? <span>{l.skipped} skipped</span> : null}
          {done ? (
            <span className="font-semibold" style={{ color: "var(--tap-success-600, #16a34a)" }}>
              ✓ Complete
            </span>
          ) : null}
        </span>
      </div>
      <ProgressBar value={l.completed} max={l.total} label={`Level ${l.number}`} />
      {!done && l.nextLessonId && l.completed + l.skipped > 0 ? (
        <Link href={`${LESSONS}/${l.nextLessonId}`} className="tap-link-btn w-fit text-xs">
          Continue: {l.nextLessonTitle} →
        </Link>
      ) : null}
    </li>
  );
}

export default async function ProgressPage() {
  const base = await typingBase();
  const LESSONS = `${base}/lessons`;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "progress");
  const { session, store } = await studentContext(locale);
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  const [o, games, arcade] = await Promise.all([
    loadProgressOverview(client, session.userId),
    getProgressData(session.userId, store),
    createArcadeStore(client).overview(session.userId),
  ]);

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
  const gameRows = ARCADE_GAMES.map((g) => ({ info: g, state: arcade.games.get(g.slug) })).filter((r) => r.state?.unlocked);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Progress" description="কী শিখেছেন, কতটা এগিয়েছেন আর কোথায় উন্নতি হচ্ছে — সব এক জায়গায়।" />

      {/* Headline numbers */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={Trophy} label="Rank" value={`Level ${r.level} · ${r.title}`} hint={r.next === null ? "Top rank!" : `${r.xp} XP · ${r.next - r.xp} XP to ${r.nextTitle}`}>
          <ProgressBar value={rankPct} max={100} label="Rank progress" />
        </Tile>
        <Tile icon={BookOpen} label="Lessons completed" value={`${o.lessons.completed} / ${o.lessons.total}`} hint={`${o.lessons.stars} / ${o.lessons.maxStars} stars · ${fmtDuration(o.lessons.timeMs)} in lessons`}>
          {nextLevel?.nextLessonId ? (
            <Link href={`${LESSONS}/${nextLevel.nextLessonId}`} className="tap-link-btn inline-flex items-center gap-1 text-xs">
              Next lesson: {nextLevel.nextLessonTitle} <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : null}
        </Tile>
        <Tile
          icon={Zap}
          label="Best speed"
          value={bestSpeed > 0 ? `${bestSpeed} wpm` : "—"}
          hint={
            o.bestTest
              ? `${o.bestTest.title} · ${Math.round(o.bestTest.accuracy)}% accuracy`
              : bestSpeed > 0
                ? `In lessons · best accuracy ${Math.round(o.lessons.bestAccuracy)}%`
                : "একটা টেস্ট দিয়ে গতি মাপুন"
          }
        />
        <Tile icon={Clock} label="Typed today" value={`${o.todayMinutes} / ${o.goalMinutes} min`} hint={`${weekMinutes} min in the last 7 days`}>
          <ProgressBar value={Math.min(o.todayMinutes, o.goalMinutes)} max={o.goalMinutes} label="Daily goal" />
        </Tile>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* Lessons by level */}
        <Card>
          <CardContent>
            <SectionHeader title="Lessons by level" description="প্রতিটা লেভেলে কয়টা লেসন শেষ, কত স্টার, আর পরের লেসন কোনটা।" />
            <ul className="flex flex-col gap-4">
              {enLevels.map((l) => (
                <LevelRow key={l.id} l={l} LESSONS={LESSONS} />
              ))}
            </ul>
            <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--tap-border)" }}>
              <p className="mb-3 text-sm font-bold">Bangla</p>
              {bnStarted ? (
                <ul className="flex flex-col gap-4">
                  {bnLevels.map((l) => (
                    <LevelRow key={l.id} l={l} LESSONS={LESSONS} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">
                  বাংলা লেসন এখনো শুরু হয়নি। English Level 1-এর Final Assessment শেষ করলে বাংলা খুলে যায়।{" "}
                  <Link href={`${LESSONS}?mode=bn`} className="tap-link-btn">
                    Bangla lessons
                  </Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent>
              <SectionHeader title="Test speed over time" description="প্রতিটা টাইপিং টেস্টের WPM, পুরনো থেকে নতুন। বিন্দুর ওপর মাউস রাখলে বিস্তারিত দেখাবে।" />
              {o.tests.length >= 2 ? (
                <SpeedChart points={o.tests} />
              ) : (
                <p className="py-6 text-center text-sm text-ink-muted">
                  গ্রাফ দেখতে অন্তত দুটো টেস্ট দিন।{" "}
                  <Link href={`${base}/tests`} className="tap-link-btn">
                    Take a test
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <SectionHeader title="Daily typing (last 14 days)" description="লেসন, টেস্ট আর Practice মিলিয়ে মিনিট। ড্যাশ-রেখা = আপনার দৈনিক লক্ষ্য।" />
              <MinutesChart days={o.days} goal={o.goalMinutes} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* Activity feed */}
        <Card>
          <CardContent>
            <SectionHeader title="Recent activity" description="কী করেছেন আর তার জন্য কত XP পেয়েছেন।" />
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
            <SectionHeader title="Game records" description={`প্রতিটা খোলা গেমে আপনার সেরা স্কোর · Coins: ${arcade.coins}`} />
            {gameRows.length === 0 ? (
              <p className="text-sm text-ink-muted">
                এখনো কোনো গেম খেলেননি।{" "}
                <Link href={`${base}/games`} className="tap-link-btn">
                  Play a game
                </Link>
              </p>
            ) : (
              <table className="tap-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Game</th>
                    <th className="text-right" style={{ textAlign: "right" }}>Plays</th>
                    <th className="text-right" style={{ textAlign: "right" }}>Best level</th>
                    <th className="text-right" style={{ textAlign: "right" }}>Best score</th>
                  </tr>
                </thead>
                <tbody>
                  {gameRows.map(({ info, state }) => (
                    <tr key={info.slug}>
                      <td>
                        <Link href={`${base}/games/${info.slug}`} className="font-semibold hover:underline">
                          {info.title}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{state?.plays ?? 0}</td>
                      <td className="text-right tabular-nums">{state?.bestLevel ?? "—"}</td>
                      <td className="text-right font-semibold tabular-nums">{state?.best != null ? state.best.toLocaleString("en-US") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {games.achievements.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  <Medal className="h-4 w-4" aria-hidden="true" /> Achievements
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
