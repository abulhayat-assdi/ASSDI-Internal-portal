import { notFound } from "next/navigation";
import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { tournamentPageContext } from "@/lib/typing-game/server/tournament-pages";
import { TournamentAdminActions } from "@/components/typing-game/tournament-admin-actions";
import { TournamentBracket } from "@/components/typing-game/tournament-bracket";

/** Admin tournament management: lifecycle, seeding, rounds, finalize. */
export default async function AdminTournamentManagePage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "tournaments");
  const { session, store } = await tournamentPageContext(locale);
  const detail = await store.getTournament(params.id, session.userId);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={detail.name}
        description={`${detail.slug} · ${detail.status}`}
      />
      <Card>
        <CardContent>
          <TournamentAdminActions
            locale={locale}
            tournamentId={detail.id}
            status={detail.status}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <h2 className="mb-2 text-base font-bold">
            {t("participants")}: {detail.participantCount}
          </h2>
          <p className="text-sm text-ink-muted">
            {detail.participantType === "clan" ? t("typeClan") : t("typeStudent")} ·{" "}
            {detail.format}
          </p>
        </CardContent>
      </Card>
      <TournamentBracket
        locale={locale}
        rounds={detail.rounds}
        highlightId={null}
      />
    </div>
  );
}
