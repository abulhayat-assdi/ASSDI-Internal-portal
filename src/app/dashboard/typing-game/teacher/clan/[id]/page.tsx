import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, Card, CardContent, EmptyState, SectionHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { clanPageContext } from "@/lib/typing-game/server/clan-pages";
import { warPageContext } from "@/lib/typing-game/server/war-pages";
import { bossPageContext } from "@/lib/typing-game/server/boss-pages";
import { ClanBanner } from "@/components/typing-game/clan-banner";
import { ClanMembersTable } from "@/components/typing-game/clan-members-table";

/** Teacher clan view: members, contribution, mission progress. */
export default async function TeacherClanDetailPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "clans");
  const ts = getTranslator(locale, "staff");
  const { store } = await clanPageContext(locale);
  const clan = await store.getClan(params.id);
  if (!clan) notFound();
  const { store: warStore } = await warPageContext(locale);
  const wars = (await warStore.listWars()).filter(
    (w) => w.challengerClanId === clan.id || w.defenderClanId === clan.id,
  );
  const { store: bossStore } = await bossPageContext(locale);
  const battles = (await bossStore.listMyInstances()).filter(
    (i) => i.clanId === clan.id,
  );
  const [roster, missions, activity] = await Promise.all([
    store.getRoster(clan.id),
    store.getMissions(clan.id),
    store.getActivity(clan.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <ClanBanner locale={locale} clan={clan} />
      <Card>
        <CardContent>
          <SectionHeader title={t("sectionMembers")} />
          <ClanMembersTable locale={locale} rows={roster} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SectionHeader title={t("sectionMissions")} />
          {missions.length === 0 ? (
            <EmptyState title={t("sectionMissions")} description={t("emptySection")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="tap-table">
                <thead>
                  <tr>
                    <th scope="col">{t("sectionMissions")}</th>
                    <th scope="col">{ts("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {missions.map((m) => (
                    <tr key={m.id}>
                      <th scope="row">{m.title}</th>
                      <td>
                        <Badge tone={m.status === "active" ? "success" : "neutral"}>
                          {m.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SectionHeader title={t("sectionActivity")} />
          {activity.length === 0 ? (
            <EmptyState title={t("sectionActivity")} description={t("emptySection")} />
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-ink-muted">
              {activity.slice(0, 10).map((a, i) => (
                <li key={`${a.createdAt}-${String(i)}`}>
                  {a.kind} · {a.createdAt}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SectionHeader title={t("warPreview")} />
          {wars.length === 0 ? (
            <EmptyState title={t("warPreview")} description={t("emptySection")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="tap-table">
                <thead>
                  <tr>
                    <th scope="col">{t("warPreview")}</th>
                    <th scope="col">{ts("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {wars.map((w) => (
                    <tr key={w.id}>
                      <th scope="row">
                        <Link href={`/student-dashboard/typing-game/clan/wars/${w.id}`}>
                          {w.challengerName} vs {w.defenderName}
                        </Link>
                      </th>
                      <td>
                        <Badge tone={w.status === "live" ? "success" : "neutral"}>
                          {w.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SectionHeader title={t("bossPreview")} />
          {battles.length === 0 ? (
            <EmptyState title={t("bossPreview")} description={t("emptySection")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="tap-table">
                <thead>
                  <tr>
                    <th scope="col">{t("bossPreview")}</th>
                    <th scope="col">{ts("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {battles.map((b) => (
                    <tr key={b.id}>
                      <th scope="row">
                        <Link href={`/student-dashboard/typing-game/clan/bosses/${b.id}`}>
                          {b.bossName} ({b.currentHp}/{String(b.initialHp)} HP)
                        </Link>
                      </th>
                      <td>
                        <Badge tone={b.status === "active" ? "success" : "neutral"}>
                          {b.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
