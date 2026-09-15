import { notFound } from "next/navigation";
import { Badge, Card, CardContent, PageHeader, SectionHeader, StatCard } from "@/components/typing-game/ui";
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
        description={
          <>
            {detail.slug}{" "}
            <Badge tone={detail.status === "active" ? "success" : "neutral"}>
              {detail.status}
            </Badge>
          </>
        }
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
          <SectionHeader title={t("sectionDetails")} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label={t("participants")} value={detail.participantCount} />
            <StatCard
              label={t("fieldParticipantType")}
              value={detail.participantType === "clan" ? t("typeClan") : t("typeStudent")}
            />
            <StatCard label={t("status")} value={detail.format} />
          </div>
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
