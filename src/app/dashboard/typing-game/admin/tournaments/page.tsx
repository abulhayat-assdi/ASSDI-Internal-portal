import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { Badge, EmptyState, PageHeader, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { tournamentPageContext } from "@/lib/typing-game/server/tournament-pages";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  active: "success",
  finalized: "primary",
  cancelled: "warning",
};

/** Admin tournament list (drafts included via RLS admin policy). */
export default async function AdminTournamentsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "tournaments");
  const { store } = await tournamentPageContext(locale);
  const tournaments = await store.listTournaments();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("manageTitle")}
        actions={
          <Link
            href="/dashboard/typing-game/admin/tournaments/new"
            className="tap-btn tap-btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{t("createTitle")}</span>
          </Link>
        }
      />
      {tournaments.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-8 w-8" aria-hidden="true" />}
          title={t("manageTitle")}
          description={t("noTournaments")}
          action={
            <Link
              href="/dashboard/typing-game/admin/tournaments/new"
              className="tap-btn tap-btn-primary"
            >
              {t("createTitle")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tournaments.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/typing-game/admin/tournaments/${s.id}`}
              className="tap-card tap-card-interactive flex flex-col gap-2 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="tap-card-title">{s.name}</h3>
                <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
              </div>
              <p className="text-xs text-ink-faint">{s.slug}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
