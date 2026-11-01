import { notFound } from "next/navigation";
import { Badge, Card, CardContent, PageHeader, SectionHeader, type BadgeTone } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { tournamentPageContext } from "@/lib/typing-game/server/tournament-pages";
import {
  TournamentBracket,
  TournamentResults,
} from "@/components/typing-game/tournament-bracket";
import { TournamentActions } from "@/components/typing-game/tournament-actions";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  registration_open: "primary",
  registration_closed: "warning",
  seeded: "warning",
  live: "danger",
  processing: "warning",
  finalized: "success",
  cancelled: "neutral",
};

/**
 * Student tournament detail: theme, registration, bracket, my match,
 * results, rewards note. Never exposes admin controls.
 */
export default async function TournamentDetailPage(
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

  const registered = detail.myStatus === "active";
  const open = detail.status === "registration_open";
  const myMatches = detail.rounds.flatMap((r) =>
    r.matches.filter(
      (m) =>
        detail.myParticipantId !== null &&
        (m.participantA?.id === detail.myParticipantId ||
          m.participantB?.id === detail.myParticipantId) &&
        m.status !== "finalized" &&
        m.status !== "bye",
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={detail.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {detail.theme.length > 0 ? <span>{detail.theme}</span> : null}
            <Badge tone={STATUS_TONE[detail.status] ?? "neutral"}>
              {detail.status === "live" ? (
                <span className="tap-live-dot" aria-hidden="true" />
              ) : null}
              {detail.status}
            </Badge>
          </span>
        }
      />
      <Card data-visual="grand-arena">
        <CardContent>
          <SectionHeader title={t("sectionDetails")} />
          <p className="text-sm text-ink-muted">{detail.description}</p>
          <p className="mt-2 text-sm">
            {t("participants")}: {detail.participantCount} ·{" "}
            {detail.participantType === "clan" ? t("typeClan") : t("typeStudent")}
          </p>
          <div className="mt-3">
            <TournamentActions
              locale={locale}
              tournamentId={detail.id}
              registered={registered}
              open={open}
            />
          </div>
        </CardContent>
      </Card>
      {myMatches.length > 0 ? (
        <Card className="tap-card-recommended">
          <CardContent>
            <SectionHeader title={t("sectionMyMatch")} />
            <TournamentBracket
              locale={locale}
              rounds={detail.rounds.map((r) => ({
                ...r,
                matches: r.matches.filter((m) => myMatches.some((x) => x.id === m.id)),
              }))}
              highlightId={detail.myParticipantId}
            />
          </CardContent>
        </Card>
      ) : null}
      <div className="flex flex-col gap-3">
        <SectionHeader title={t("sectionBracket")} />
        <TournamentBracket
          locale={locale}
          rounds={detail.rounds}
          highlightId={detail.myParticipantId}
        />
      </div>
      <TournamentResults locale={locale} results={detail.results} />
      {detail.status === "finalized" ? (
        <p className="text-xs text-ink-muted">{t("finalizedNotice")}</p>
      ) : null}
    </div>
  );
}
