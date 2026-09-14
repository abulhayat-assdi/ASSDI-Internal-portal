import { EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { competitionPageContext } from "@/lib/typing-game/server/competition-pages";
import { statusSection } from "@/lib/typing-game/competitions";
import { CompetitionCard } from "@/components/typing-game/competition-card";

/** Student competition hub: upcoming / registration / live / completed. */
export default async function CompetitionsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "competitions");
  const { session, store } = await competitionPageContext(locale);
  const all = await store.listCompetitions(session.userId);

  const groups = {
    live: all.filter((c) => statusSection(c.status) === "live"),
    registration: all.filter((c) => statusSection(c.status) === "registration"),
    upcoming: all.filter((c) => statusSection(c.status) === "upcoming"),
    completed: all.filter((c) => statusSection(c.status) === "completed"),
  } as const;

  const sections = [
    { key: "live", title: t("sectionLive") },
    { key: "registration", title: t("sectionRegistration") },
    { key: "upcoming", title: t("sectionUpcoming") },
    { key: "completed", title: t("sectionCompleted") },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("hubTitle")} description={t("hubSubtitle")} />
      {all.length === 0 ? (
        <EmptyState title={t("hubTitle")} description={t("noCompetitions")} />
      ) : null}
      {sections.map((s) => (
        <section key={s.key} aria-label={s.title}>
          <h2 className="mb-2 text-base font-bold">{s.title}</h2>
          {groups[s.key].length === 0 ? (
            <p className="text-sm text-ink-muted">{t("emptySection")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {groups[s.key].map((c) => (
                <CompetitionCard
                  key={c.id}
                  locale={locale}
                  competition={c}
                  section={s.key}
                  href={`/student-dashboard/typing-game/competitions/${c.id}`}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
