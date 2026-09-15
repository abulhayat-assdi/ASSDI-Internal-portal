import { Coins, Flame, Gamepad2, Map, Target, Zap } from "lucide-react";
import {
  AchievementBadge,
  Avatar,
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  SectionHeader,
  StatCard,
  XpProgress,
} from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { getStudentProfile } from "@/lib/typing-game/server/student";

export default async function ProfilePage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "profile");
  const { session, store } = await studentContext(locale);
  const p = await getStudentProfile(session.userId, store);

  if (!p) {
    return <EmptyState title={t("title")} description={t("noRecords")} />;
  }

  const [levelRow, nextRow] = await Promise.all([
    store.getLevel(p.level),
    store.getLevel(p.level + 1),
  ]);
  const levelFloor = levelRow?.requiredXp ?? 0;
  const xpIntoLevel = Math.max(0, p.xpTotal - levelFloor);
  const xpSpan = nextRow ? Math.max(1, nextRow.requiredXp - levelFloor) : Math.max(1, xpIntoLevel);
  const xpRemaining = nextRow ? Math.max(0, xpSpan - xpIntoLevel) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={p.fullName}
        description={`${t("rollNumber")}: ${p.rollNumber} · ${p.batchName} · ${p.courseName}`}
        actions={p.skillTrack ? <Badge tone="primary">{p.skillTrack}</Badge> : undefined}
      />

      <Card>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar name={p.fullName} size="lg" />
            <div>
              <p className="text-lg font-bold">
                {t("level")} {p.level}
              </p>
              <p className="text-sm text-ink-muted">
                {t("totalXp")}: {p.xpTotal} · {t("coins")}: {p.coins}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <XpProgress
              level={p.level}
              current={xpIntoLevel}
              required={xpSpan}
              label={`${t("totalXp")}: ${p.xpTotal}`}
            />
            <p className="mt-1 text-xs text-ink-muted">
              {nextRow ? t("xpToNext", { xp: xpRemaining, level: p.level + 1 }) : t("maxLevel")}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label={t("currentStreak")}
          value={p.streak.current}
          hint={`${t("bestStreak")}: ${String(p.streak.best)}`}
          icon={<Flame className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label={t("averageWpm")}
          value={Math.round(p.averages.wpm)}
          icon={<Zap className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label={t("averageAccuracy")}
          value={`${String(Math.round(p.averages.accuracy))}%`}
          icon={<Target className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label={t("gamesCompleted")}
          value={p.gamesCompleted}
          icon={<Gamepad2 className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label={t("worldsCompleted")}
          value={p.worldsCompleted}
          icon={<Map className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label={t("coins")}
          value={p.coins}
          icon={<Coins className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <Card>
        <CardContent>
          <SectionHeader title={t("badges")} />
          {p.badges.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noBadges")}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {p.badges.map((b) => (
                <AchievementBadge key={b.slug} name={b.name} earned />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader title={t("achievements")} />
          {p.achievements.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noRecords")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {p.achievements.map((a) => (
                <StatCard key={a.slug} label={a.name} value={a.value} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader title={t("personalRecords")} />
          {p.records.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noRecords")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {p.records.slice(0, 12).map((r) => (
                <li key={`${r.gameSlug}-${r.metric}`} className="flex justify-between gap-3">
                  <span>
                    {r.gameSlug} · {r.metric}
                  </span>
                  <span className="font-semibold">{Math.round(r.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
