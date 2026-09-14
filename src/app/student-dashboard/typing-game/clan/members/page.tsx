import { Card, CardContent, EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { clanPageContext } from "@/lib/typing-game/server/clan-pages";
import { ClanMembersTable } from "@/components/typing-game/clan-members-table";

/** Full clan member list (privacy-safe columns only). */
export default async function ClanMembersPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "clans");
  const { session, store } = await clanPageContext(locale);
  const clan = await store.getMyClan(session.userId);
  if (!clan) {
    return <EmptyState title={t("sectionMembers")} description={t("emptySection")} />;
  }
  const roster = await store.getRoster(clan.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("sectionMembers")} description={clan.name} />
      <Card>
        <CardContent>
          <ClanMembersTable locale={locale} rows={roster} />
        </CardContent>
      </Card>
    </div>
  );
}
