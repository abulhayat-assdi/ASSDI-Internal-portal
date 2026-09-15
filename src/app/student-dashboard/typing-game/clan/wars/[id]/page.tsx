import { notFound } from "next/navigation";
import { Swords } from "lucide-react";
import { Badge, Card, CardContent, PageHeader, SectionHeader, type BadgeTone } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { warPageContext } from "@/lib/typing-game/server/war-pages";
import { WarBoard } from "@/components/typing-game/war-board";
import { WarActions } from "@/components/typing-game/war-actions";
import { CompetitionCountdown } from "@/components/typing-game/competition-countdown";
import { PlayButton } from "@/components/typing-game/play-button";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  challenge_sent: "primary",
  pending_response: "warning",
  accepted: "primary",
  declined: "danger",
  preparation: "warning",
  live: "danger",
  processing: "warning",
  finalized: "success",
  cancelled: "neutral",
  expired: "neutral",
};

/**
 * War detail: status-appropriate actions, server-anchored countdowns,
 * allowed games, attempts, personal contribution, privacy-safe board.
 * Typing reuses PlayButton (same M4/M6 runtime); submission binds the
 * latest validated attempt via the API.
 */
export default async function WarDetailPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "wars");
  const tg = getTranslator(locale, "games");
  const { session, store } = await warPageContext(locale);
  const war = await store.getWar(params.id);
  if (!war) notFound();
  const board = await store.getBoard(war.id);
  const serverNow = new Date().toISOString();
  const gameSlug = war.gameSlugs[0] ?? null;
  const latest = gameSlug
    ? await store.getLatestValidAttempt(gameSlug, session.userId)
    : null;

  const staffActions: ("dispatch" | "cancel" | "advance" | "sync" | "finalize")[] = [];
  if (war.status === "challenge_sent") staffActions.push("dispatch");
  if (
    war.status === "accepted" ||
    war.status === "preparation" ||
    war.status === "live"
  ) {
    staffActions.push("advance", "sync");
  }
  if (war.status === "processing") staffActions.push("finalize");
  if (
    war.status !== "finalized" &&
    war.status !== "processing" &&
    war.status !== "live"
  ) {
    staffActions.push("cancel");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("versus", {
          a: war.challengerName || "—",
          b: war.defenderName || "—",
        })}
        description={
          <Badge tone={STATUS_TONE[war.status] ?? "neutral"}>
            {war.status === "live" ? (
              <span className="tap-live-dot" aria-hidden="true" />
            ) : null}
            {war.status}
          </Badge>
        }
      />

      {(war.status === "preparation" && war.battleStart) ||
      (war.status === "accepted" && war.battleStart) ? (
        <CompetitionCountdown
          serverNowIso={serverNow}
          targetIso={war.battleStart}
          label={t("startsIn", { time: "" }).replace(/:\s*$/, "")}
        />
      ) : null}
      {war.status === "live" && war.battleEnd ? (
        <CompetitionCountdown
          serverNowIso={serverNow}
          targetIso={war.battleEnd}
          label={t("endsIn", { time: "" }).replace(/:\s*$/, "")}
        />
      ) : null}
      <p className="text-xs text-ink-muted">{t("serverTimeNote")}</p>

      <Card>
        <CardContent>
          <SectionHeader
            title={
              <span className="flex items-center gap-2">
                <Swords className="h-4 w-4 text-primary-500" aria-hidden="true" />
                {t("allowedGames")}
              </span>
            }
          />
          <p className="text-sm">{war.gameSlugs.join(", ") || "—"}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {t("attemptsLeft", {
              left: Math.max(war.attemptsPerPlayer - war.myAttempts, 0),
              limit: war.attemptsPerPlayer,
            })}
            {" · "}
            {t("myContribution", { score: war.myContribution })}
          </p>
        </CardContent>
      </Card>

      {war.status === "pending_response" ? (
        <WarActions locale={locale} warId={war.id} actions={["accept", "decline"]} />
      ) : null}
      {staffActions.length > 0 ? (
        <WarActions locale={locale} warId={war.id} actions={staffActions} />
      ) : null}

      {war.status === "live" && gameSlug ? (
        <Card>
          <CardContent>
            <div className="flex flex-col gap-3">
              <PlayButton
                gameSlug={gameSlug}
                locale={locale}
                strings={{
                  play: tg("play"),
                  starting: tg("starting"),
                  failed: tg("startFailed"),
                }}
              />
              {latest ? (
                <WarActions
                  locale={locale}
                  warId={war.id}
                  actions={["submit"]}
                  attemptId={latest.id}
                />
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <WarBoard locale={locale} rows={board} />
        </CardContent>
      </Card>

      {war.status === "finalized" ? (
        <p className="text-sm text-ink-muted">{t("resultsFinal")}</p>
      ) : null}
    </div>
  );
}
