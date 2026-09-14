import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { tournamentPageContext } from "@/lib/typing-game/server/tournament-pages";

/** Admin tournament list (drafts included via RLS admin policy). */
export default async function AdminTournamentsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "tournaments");
  const { store } = await tournamentPageContext(locale);
  const tournaments = await store.listTournaments();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("manageTitle")} />
      <div>
        <Link
          className="tap-btn tap-btn-primary"
          href={`/dashboard/typing-game/admin/tournaments/new`}
        >
          {t("createTitle")}
        </Link>
      </div>
      {tournaments.length === 0 ? (
        <EmptyState title={t("manageTitle")} description={t("noTournaments")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {tournaments.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <Link href={`/dashboard/typing-game/admin/tournaments/${s.id}`}>
                {s.name} ({s.slug})
              </Link>
              <span className="tap-badge">{s.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
