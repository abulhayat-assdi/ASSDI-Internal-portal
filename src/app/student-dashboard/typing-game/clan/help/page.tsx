import { EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { clanPageContext } from "@/lib/typing-game/server/clan-pages";
import { ClanHelpBoard } from "@/components/typing-game/clan-help-board";

/** Clan help board: request assistance, fund clanmates (bounded). */
export default async function ClanHelpPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "clans");
  const { session, store } = await clanPageContext(locale);
  const clan = await store.getMyClan(session.userId);
  if (!clan) {
    return <EmptyState title={t("sectionHelp")} description={t("emptySection")} />;
  }
  const help = await store.getHelpRequests(clan.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("sectionHelp")} description={clan.name} />
      <ClanHelpBoard locale={locale} requests={help} />
    </div>
  );
}
