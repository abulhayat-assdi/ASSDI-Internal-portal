import Link from "next/link";
import type { CSSProperties } from "react";
import { CheckCircle2, Flame, Gauge, Trophy, Zap } from "lucide-react";
import {
  AchievementBadge,
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  StatCard,
  XpProgress,
} from "@/components/typing-game/ui";
import { isLocale, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getTranslator } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { getStudentDashboard } from "@/lib/typing-game/server/student";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createSupabaseMissionStore } from "@/lib/typing-game/server/mission-store";
import { createSupabaseCustomMissionStore } from "@/lib/typing-game/server/custom-mission-store";
import { listActiveIncompleteMissions } from "@/lib/typing-game/server/custom-mission-pages";
import { WelcomeBanner } from "@/components/typing-game/welcome-banner";
import { XpCounter } from "@/components/typing-game/xp-counter";
import { MissionWidgets } from "@/components/typing-game/mission-widgets";
import { RecommendedNext } from "@/components/typing-game/recommendation-card";
import { createSupabaseAdaptiveStore } from "@/lib/typing-game/server/adaptive-store";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "dashboard");
  const tp = getTranslator(locale, "profile");
  const { session, store } = await studentContext(locale);
  const data = await getStudentDashboard(session.userId, store);
  const missionClient = await userDbClient();
  const missions = missionClient
    ? await createSupabaseMissionStore(missionClient).getToday(session.userId)
    : [];
  const activeCustomMissions = missionClient
    ? await listActiveIncompleteMissions(
        createSupabaseCustomMissionStore(missionClient),
        session.userId,
      )
    : [];

  if (!data || !data.membership) {
    return (
      <EmptyState
        title={t("greeting")}
        description={t("noActivity")}
        action={
          <Link href={`/student-dashboard/typing-game/games`} className="tap-btn tap-btn-primary tap-btn-md">
            {t("exploreGames")}
          </Link>
        }
      />
    );
  }

  const recommendedHref = data.recommended
    ? `/student-dashboard/typing-game/games/${data.recommended.slug}`
    : `/student-dashboard/typing-game/games`;
  const adaptiveSummary = missionClient
    ? await createSupabaseAdaptiveStore(missionClient)
        .getSummary()
        .catch(() => null)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("greeting")}
        description={`${data.membership.batchName} · ${data.membership.courseName}`}
        actions={
          <>
            <Link href={recommendedHref} className="tap-btn tap-btn-primary tap-btn-md">
              {t("continueAdventure")}
            </Link>
            <Link href={`/student-dashboard/typing-game/games`} className="tap-btn tap-btn-secondary tap-btn-md">
              {t("exploreGames")}
            </Link>
          </>
        }
      />

      {data.isNew ? (
        <WelcomeBanner locale={locale} gameHref={recommendedHref} />
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            icon: <Zap className="h-4 w-4" />,
            label: t("level"),
            value: <XpCounter value={data.profile.level} />,
            hint: data.levelTitle,
          },
          {
            icon: <Flame className="h-4 w-4" />,
            label: tp("currentStreak"),
            value: <XpCounter value={data.streak.current} />,
            hint: `${tp("bestStreak")}: ${String(data.streak.best)}`,
          },
          {
            icon: <Gauge className="h-4 w-4" />,
            label: t("averageWpm"),
            value: <XpCounter value={Math.round(data.averages.wpm)} />,
            hint: t("averageAccuracy") + ": " + String(Math.round(data.averages.accuracy)) + "%",
          },
          {
            icon: <Trophy className="h-4 w-4" />,
            label: t("batchRank"),
            value: data.rank ? `#${String(data.rank.rank)}` : "—",
            hint: data.rank
              ? t("ofStudents").replace("{count}", String(data.rank.total))
              : t("noActivity"),
          },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="tap-anim-in"
            style={{ "--tap-i": i } as CSSProperties}
          >
            <StatCard icon={stat.icon} label={stat.label} value={stat.value} hint={stat.hint} />
          </div>
        ))}
      </div>

      <Card>
        <CardContent>
          <XpProgress
            level={data.profile.level}
            current={data.profile.xpTotal}
            required={
              data.xpToNext === null
                ? data.profile.xpTotal
                : data.profile.xpTotal + data.xpToNext
            }
            label={t("nextMilestone")}
          />
          <p className="mt-2 text-sm text-ink-muted">
            {data.xpToNext === null
              ? t("maxLevel")
              : t("xpToNextLevel")
                  .replace("{xp}", String(data.xpToNext))
                  .replace("{level}", String(data.profile.level + 1))}
          </p>
        </CardContent>
      </Card>

      <MissionWidgets locale={locale} missions={activeCustomMissions} />

      <RecommendedNext
        locale={locale}
        recommendation={adaptiveSummary?.recommendations[0] ?? null}
      />

      {data.latestBadge ? (        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <AchievementBadge name={data.latestBadge.name} earned />
              <div>
                <p className="text-sm font-semibold">{t("latestBadge")}</p>
                <p>{data.latestBadge.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <h2 className="mb-3 text-base font-bold">{t("recentActivity")}</h2>
          {data.recentAttempts.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noActivity")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.recentAttempts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 font-medium">
                    {a.status === "validated" ? (
                      <CheckCircle2
                        className="h-4 w-4"
                        style={{ color: "var(--tap-success-500)" }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {a.gameSlug}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={a.status === "validated" ? "success" : "neutral"}>
                      {a.status}
                    </Badge>
                    {a.score !== null ? <span className="font-bold">{a.score}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
