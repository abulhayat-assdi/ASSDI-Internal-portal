import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { competitionPageContext } from "@/lib/typing-game/server/competition-pages";
import { statusSection } from "@/lib/typing-game/competitions";
import { CompetitionCard } from "@/components/typing-game/competition-card";

/** Teacher competitions: visible (RLS-scoped) list + creation entry. */
export default async function TeacherCompetitionsPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "competitions");
  const { session, store } = await competitionPageContext(locale);
  const all = await store.listCompetitions(session.userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("manageTitle")} />
      <div>
        <Link
          className="tap-btn tap-btn-primary"
          href={`/dashboard/typing-game/teacher/competitions/new`}
        >
          {t("createTitle")}
        </Link>
      </div>
      {all.length === 0 ? (
        <EmptyState title={t("manageTitle")} description={t("noCompetitions")} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {all.map((c) => (
            <CompetitionCard
              key={c.id}
              locale={locale}
              competition={c}
              section={statusSection(c.status)}
              href={`/dashboard/typing-game/teacher/competitions/${c.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
