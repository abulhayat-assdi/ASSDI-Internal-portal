import Link from "next/link";
import { BookOpenCheck, Clock3, Dumbbell, Gamepad2, Gauge, GraduationCap, Timer, Trophy } from "lucide-react";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { createActivityStore } from "@/lib/typing-game/server/activity-store";
import { createLessonStore } from "@/lib/typing-game/server/lesson-store";
import { loadProgressOverview } from "@/lib/typing-game/server/progress-overview";
import { createArcadeStore } from "@/lib/typing-game/server/arcade-store";
import { myFeatures } from "@/lib/typing-game/server/features";
import { levelsFor } from "@/lib/typing-game/curriculum";
import { lessonStates, trackLessons } from "@/lib/typing-game/curriculum/progress";
import { LEARN_BASE } from "@/lib/typing-game/base";
import { DailyGoalCard } from "@/components/typing-game/daily-goal-card";
import { ConsoleHero, HeroLink, Kpi } from "@/components/typing-game/staff/blocks";
import { EmptyState } from "@/components/typing-game/ui";

export const dynamic = "force-dynamic";

/** Home of a teacher's own practice: today's goal, where to continue, and the four ways to practise. */
export default async function LearnDashboardPage() {
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <EmptyState title="Typing Adventure" />;

  const [overview, goal, progress, arcade, features] = await Promise.all([
    loadProgressOverview(client, session.userId),
    createActivityStore(client).state(session.userId),
    createLessonStore(client).listProgress(session.userId).catch(() => null),
    createArcadeStore(client).overview(session.userId).catch(() => null),
    myFeatures(client),
  ]);
  let nextLessonHref = `${LEARN_BASE}/lessons`;
  if (progress) {
    const levels = levelsFor("en");
    const states = lessonStates(levels, progress);
    const next = trackLessons(levels).find((l) => states.get(l.id) === "available");
    if (next) nextLessonHref = `${LEARN_BASE}/lessons/${next.id}`;
  }
  const r = overview.rank;
  const minutes = overview.days.reduce((n, d) => n + d.minutes, 0);
  const started = overview.lessons.completed > 0;

  const tiles = [
    { href: `${LEARN_BASE}/lessons`, icon: GraduationCap, title: "Lessons", desc: "হোম রো থেকে শুরু করে ধাপে ধাপে ইংরেজি ও বাংলা টাইপিং।" },
    { href: `${LEARN_BASE}/practice`, icon: Dumbbell, title: "Practice", desc: "সময় বা শব্দ ধরে ইচ্ছেমতো অনুশীলন।" },
    { href: `${LEARN_BASE}/tests`, icon: Timer, title: "Typing Tests", desc: "স্পিড ও নির্ভুলতা মেপে সার্টিফিকেট।" },
    ...(features.ARCADE_GAMES_ENABLED
      ? [{ href: `${LEARN_BASE}/games`, icon: Gamepad2, title: "Games", desc: `৮টা টাইপিং গেম · আপনার ${arcade?.coins ?? 0} কয়েন আছে।` }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        tone="teacher"
        kicker="My Practice"
        title={started ? "Keep typing" : "Learn to type yourself"}
        desc={`লেভেল ${r.level}${r.title ? ` · ${r.title}` : ""} · ${r.xp} XP। স্টুডেন্টদের মতোই সব লেসন, টেস্ট আর গেম, শুধু আপনার নিজের জন্য। এখানকার অগ্রগতি কোনো স্টুডেন্ট বা ড্যাশবোর্ডে দেখা যায় না।`}
      >
        <HeroLink href={nextLessonHref}>{started ? "Continue lessons" : "Start the first lesson"}</HeroLink>
      </ConsoleHero>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <div className="flex flex-col gap-5 xl:col-span-2">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icon={Trophy} label="Level" value={r.level} hint={r.next !== null ? `${Math.max(0, r.next - r.xp)} XP to next level` : "Top level"} tone="amber" />
            <Kpi icon={BookOpenCheck} label="Lessons done" value={`${overview.lessons.completed}/${overview.lessons.total}`} hint={`${overview.lessons.stars} stars`} tone="violet" />
            <Kpi icon={Gauge} label="Best test" value={overview.bestTest ? `${Math.round(overview.bestTest.wpm)} wpm` : "—"} hint={overview.bestTest ? `${Math.round(overview.bestTest.accuracy)}% accuracy` : "No tests yet"} tone="indigo" />
            <Kpi icon={Clock3} label="Typed (14 days)" value={`${minutes} min`} hint={`${overview.todayMinutes} min today`} tone="sky" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {tiles.map((t) => (
              <Link key={t.href} href={t.href} className="sc-card sc-row-link flex items-start gap-3 p-4">
                <span className="sc-kpi-icon sc-tone-emerald shrink-0">
                  <t.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-display text-lg font-extrabold">{t.title}</span>
                  <span className="block text-sm text-ink-muted">{t.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
        <DailyGoalCard goalMinutes={goal.goalMinutes} todayMs={goal.todayMs} week={goal.week} />
      </div>
    </div>
  );
}
