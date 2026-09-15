import Link from "next/link";
import { Badge, Card, CardContent, EmptyState, SectionHeader, type BadgeTone } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { clanPageContext } from "@/lib/typing-game/server/clan-pages";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createSupabaseSeasonStore } from "@/lib/typing-game/server/season-store";
import { ClanBanner } from "@/components/typing-game/clan-banner";
import { ClanMembersTable } from "@/components/typing-game/clan-members-table";
import { ClanHelpBoard } from "@/components/typing-game/clan-help-board";
import { ClanLockedPreviews } from "@/components/typing-game/clan-locked-previews";
import { ClanMissionActions } from "@/components/typing-game/clan-mission-actions";

const MISSION_STATUS_TONE: Record<string, BadgeTone> = {
  locked: "neutral",
  available: "primary",
  active: "warning",
  completed: "success",
  expired: "neutral",
  cancelled: "danger",
};

/** Student clan dashboard: identity, rank, contributors, missions, help. */
export default async function ClanPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "clans");
  const tw = getTranslator(locale, "wars");
  const tb = getTranslator(locale, "bosses");
  const ts = getTranslator(locale, "seasons");
  const { session, store } = await clanPageContext(locale);
  const clan = await store.getMyClan(session.userId);
  if (!clan) {
    return <EmptyState title={t("hubTitle")} description={t("emptySection")} />;
  }
  const client = await userDbClient();
  const seasons = client
    ? await createSupabaseSeasonStore(client).listSeasons()
    : [];
  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const clanSeasonBoard =
    client && activeSeason
      ? await createSupabaseSeasonStore(client).getBoard(activeSeason.id, "clan")
      : [];
  const clanSeasonRow = clanSeasonBoard.find((r) => r.participantId === clan.id) ?? null;
  const [roster, missions, help, activity] = await Promise.all([
    store.getRoster(clan.id),
    store.getMissions(clan.id),
    store.getHelpRequests(clan.id),
    store.getActivity(clan.id),
  ]);
  const top = [...roster]
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <ClanBanner locale={locale} clan={clan} topMembers={top} />

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/student-dashboard/typing-game/clan/wars`}
          className="tap-btn tap-btn-primary"
        >
          {tw("hubTitle")}
        </Link>
        <Link
          href={`/student-dashboard/typing-game/clan/bosses`}
          className="tap-btn tap-btn-primary"
        >
          {tb("hubTitle")}
        </Link>
        <Link href={`/student-dashboard/typing-game/season`} className="tap-btn tap-btn-primary">
          {ts("hubTitle")}
        </Link>
      </div>

      {activeSeason && clanSeasonRow ? (
        <Card>
          <CardContent>
            <p className="text-sm font-bold">
              {activeSeason.name} ·{" "}
              {ts("myPoints", { points: clanSeasonRow.points })} ·{" "}
              {ts("myRank", { rank: clanSeasonRow.rank })}
              {clanSeasonRow.tier === null
                ? ""
                : ` · ${ts("myTier", { tier: clanSeasonRow.tier })}`}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <SectionHeader
            title={t("sectionTop")}
            actions={
              <Link
                href={`/student-dashboard/typing-game/clan/members`}
                className="tap-btn tap-btn-secondary tap-btn-sm"
              >
                {t("viewMembers")}
              </Link>
            }
          />
          <ClanMembersTable locale={locale} rows={top} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader
            title={t("sectionMissions")}
            actions={
              <Link
                href={`/student-dashboard/typing-game/clan/missions`}
                className="tap-btn tap-btn-secondary tap-btn-sm"
              >
                {t("viewMissions")}
              </Link>
            }
          />
          <div className="flex flex-col gap-3">
            {missions.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("emptySection")}</p>
            ) : null}
            {missions.slice(0, 3).map((m) => (
              <div key={m.id} className="tap-mission">
                <div className="tap-mission-top">
                  <span className="tap-mission-title">{m.title}</span>
                  <Badge tone={MISSION_STATUS_TONE[m.status] ?? "neutral"}>
                    {m.status}
                  </Badge>
                </div>
                <ClanMissionActions
                  locale={locale}
                  missionId={m.id}
                  status={m.status}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader
            title={t("sectionHelp")}
            actions={
              <Link
                href={`/student-dashboard/typing-game/clan/help`}
                className="tap-btn tap-btn-secondary tap-btn-sm"
              >
                {t("viewHelp")}
              </Link>
            }
          />
          <ClanHelpBoard locale={locale} requests={help.slice(0, 3)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader title={t("sectionActivity")} />
          {activity.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("emptySection")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {activity.slice(0, 10).map((a, i) => (
                <li
                  key={`${a.createdAt}-${String(i)}`}
                  className="flex items-center justify-between gap-2 border-b border-line pb-2 last:border-none last:pb-0"
                >
                  <span className="font-semibold">{a.kind}</span>
                  <span className="text-ink-muted">{a.createdAt}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ClanLockedPreviews locale={locale} />
    </div>
  );
}
