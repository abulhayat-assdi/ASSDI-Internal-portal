import { notFound } from "next/navigation";
import { Badge, Card, CardContent, EmptyState, SectionHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { clanPageContext } from "@/lib/typing-game/server/clan-pages";
import { ClanBanner } from "@/components/typing-game/clan-banner";
import { ClanMembersTable } from "@/components/typing-game/clan-members-table";
import { ClanAdminActions } from "@/components/typing-game/clan-admin-actions";

/** Admin clan management: profile, status, roles, mission linking. */
export default async function AdminClanManagePage(
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
  const [roster, missions] = await Promise.all([
    store.getRoster(clan.id),
    store.getMissions(clan.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <ClanBanner locale={locale} clan={clan} />
      <Card>
        <CardContent>
          <ClanAdminActions locale={locale} clanId={clan.id} />
        </CardContent>
      </Card>
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
    </div>
  );
}