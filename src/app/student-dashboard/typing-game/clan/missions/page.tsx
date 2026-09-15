import { Badge, Card, CardContent, EmptyState, PageHeader, ProgressBar, type BadgeTone } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { clanPageContext } from "@/lib/typing-game/server/clan-pages";
import { ClanMissionActions } from "@/components/typing-game/clan-mission-actions";

const STATUS_TONE: Record<string, BadgeTone> = {
  locked: "neutral",
  available: "primary",
  active: "warning",
  completed: "success",
  expired: "neutral",
  cancelled: "danger",
};

/** Clan mission board: aggregate progress, start/sync actions. */
export default async function ClanMissionsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "clans");
  const { session, store } = await clanPageContext(locale);
  const clan = await store.getMyClan(session.userId);
  if (!clan) {
    return <EmptyState title={t("sectionMissions")} description={t("emptySection")} />;
  }
  const missions = await store.getMissions(clan.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("sectionMissions")} description={clan.name} />
      {missions.length === 0 ? (
        <EmptyState title={t("sectionMissions")} description={t("emptySection")} />
      ) : (
        missions.map((m) => (
          <Card key={m.id} className={m.status === "completed" ? "tap-mission-done" : undefined}>
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold">{m.title}</h2>
                <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>{m.status}</Badge>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {m.objectives.map((o) => (
                  <div key={o.position} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs text-ink-muted">
                      <span className="font-semibold text-ink">{o.kind}</span>
                      <span>
                        {o.current}/{o.target}
                      </span>
                    </div>
                    <ProgressBar
                      value={o.current}
                      max={Math.max(o.target, 1)}
                      label={`${o.kind}: ${String(o.current)}/${String(o.target)}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <ClanMissionActions
                  locale={locale}
                  missionId={m.id}
                  status={m.status}
                />
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
