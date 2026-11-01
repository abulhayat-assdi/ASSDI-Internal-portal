import Link from "next/link";
import { EmptyState, PageHeader, SectionHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { tournamentPageContext } from "@/lib/typing-game/server/tournament-pages";
import { TournamentCard } from "@/components/typing-game/tournament-card";

/** Student tournament hub: live cups first, history below. */
export default async function TournamentsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "tournaments");
  const tn = getTranslator(locale, "nav");
  const { store } = await tournamentPageContext(locale);
  const tournaments = await store.listTournaments();
  const live = tournaments.filter((s) => s.status !== "finalized");
  const history = tournaments.filter((s) => s.status === "finalized");

  return (
    <div className="flex flex-col gap-6" data-visual="grand-arena">
      <PageHeader title={t("hubTitle")} description={t("hubSubtitle")} />
      {tournaments.length === 0 ? (
        <EmptyState title={t("hubTitle")} description={t("noTournaments")} />
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {live.map((s) => (
          <TournamentCard
            key={s.id}
            locale={locale}
            tournament={s}
            href={`/student-dashboard/typing-game/tournaments/${s.id}`}
          />
        ))}
      </div>
      {history.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SectionHeader title={t("sectionHistory")} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {history.map((s) => (
              <TournamentCard
                key={s.id}
                locale={locale}
                tournament={s}
                href={`/student-dashboard/typing-game/tournaments/${s.id}`}
              />
            ))}
          </div>
        </div>
      ) : null}
      <p className="text-xs text-ink-muted">
        <Link href={`/student-dashboard/typing-game/dashboard`} className="hover:underline">
          {tn("dashboard")}
        </Link>
      </p>
    </div>
  );
}
