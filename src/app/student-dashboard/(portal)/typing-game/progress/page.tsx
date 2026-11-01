import { Flame, Gauge, Zap } from "lucide-react";
import {
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionHeader,
  StatCard,
} from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { getProgressData } from "@/lib/typing-game/server/student";
import { worldVisual } from "@/lib/typing-game/world-visuals";

export default async function ProgressPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "progress");
  const tp = getTranslator(locale, "profile");
  const { session, store } = await studentContext(locale);
  const data = await getProgressData(session.userId, store);

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState title={t("title")} description={t("noHistory")} />
      </div>
    );
  }

  const bestOf = (metric: string): number | null =>
    data.records
      .filter((r) => r.metric === metric)
      .reduce<number | null>((max, r) => (max === null || r.value > max ? r.value : max), null);
  const bestWpm = bestOf("best_wpm");
  const bestAccuracy = bestOf("best_accuracy");
  const bestScore = bestOf("best_score");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label={tp("bestWpm")}
          value={bestWpm === null ? "—" : Math.round(bestWpm)}
          icon={<Zap className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label={tp("bestAccuracy")}
          value={bestAccuracy === null ? "—" : `${String(Math.round(bestAccuracy))}%`}
          icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label={tp("bestScore")}
          value={bestScore === null ? "—" : Math.round(bestScore)}
          icon={<Flame className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      {data.perWorld.length > 0 ? (
        <Card>
          <CardContent>
            <SectionHeader title={t("worldProgress")} />
            <div className="flex flex-col gap-3">
              {data.perWorld.map((w) => (
                <div key={w.worldSlug} data-visual={worldVisual(w.worldSlug)} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold capitalize">{w.worldSlug.replace(/-/g, " ")}</span>
                    <span className="text-ink-muted">
                      {w.completed}/{w.total}
                    </span>
                  </div>
                  <ProgressBar value={w.completed} max={Math.max(w.total, 1)} label={w.worldSlug} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <SectionHeader title={t("xpHistory")} />
          {data.xpHistory.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noHistory")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {data.xpHistory.slice(0, 15).map((e, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{e.reason || t("xpGain").replace("{xp}", String(e.amount))}</span>
                  <span className="font-semibold text-primary-600">
                    +{e.amount} XP · {e.createdAt.slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader title={t("achievements")} />
          {data.achievements.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noHistory")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {data.achievements.map((a) => (
                <StatCard key={a.slug} label={a.name} value={a.value} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader title={t("records")} />
          {data.records.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noHistory")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {data.records.slice(0, 15).map((r) => (
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

      <Card>
        <CardContent>
          <SectionHeader title={t("streakHistory")} />
          {data.activeDays.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noHistory")}</p>
          ) : (
            <p className="text-sm">
              {data.activeDays.slice(0, 30).join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
