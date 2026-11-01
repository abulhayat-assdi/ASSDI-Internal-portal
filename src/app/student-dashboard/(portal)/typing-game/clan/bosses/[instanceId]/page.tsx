import { notFound } from "next/navigation";
import { Clock, Flame, ScrollText, Swords, Trophy } from "lucide-react";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  PageHeader,
  ProgressBar,
  type BadgeTone,
} from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { bossPageContext } from "@/lib/typing-game/server/boss-pages";
import { BossHpBar } from "@/components/typing-game/boss-hp-bar";
import { BossStrikeButton } from "@/components/typing-game/boss-strike-button";
import { CompetitionCountdown } from "@/components/typing-game/competition-countdown";
import { PlayButton } from "@/components/typing-game/play-button";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createSupabaseStudentStore } from "@/lib/typing-game/server/student-store";

const DIFFICULTY_TONE: Record<string, BadgeTone> = {
  easy: "success",
  normal: "primary",
  hard: "warning",
  nightmare: "legendary",
};

/**
 * Boss fight screen: HP + phase, countdown, PlayButton (same M4/M6
 * runtime), strike binding, contribution board, activity feed, results.
 */
export default async function BossFightPage(
  props: {
    params: Promise<{ locale: string; instanceId: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "bosses");
  const tg = getTranslator(locale, "games");
  const { session, store } = await bossPageContext(locale);
  const state = await store.getState(params.instanceId);
  if (!state) notFound();
  const phase = state.phases.find(
    (p) => p.position === state.instance.currentPhase,
  );
  const client = await userDbClient();
  const games = client
    ? await createSupabaseStudentStore(client).listGames()
    : [];
  const gameSlug = games[0]?.slug ?? null;
  const latest =
    client && gameSlug
      ? await store.getLatestValidAttempt(gameSlug, session.userId)
      : null;
  const serverNow = new Date().toISOString();
  const defeated = state.instance.status === "defeated" || state.instance.status === "finalized";
  const expired = state.instance.status === "expired";
  const finished = defeated || expired;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Flame className="h-6 w-6" style={{ color: "var(--tap-danger-500)" }} aria-hidden="true" />
            {state.boss.name}
          </span>
        }
        description={state.boss.lore}
        actions={
          <Badge tone={DIFFICULTY_TONE[state.boss.difficulty] ?? "neutral"}>
            {state.boss.difficulty}
          </Badge>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <BossHpBar
            locale={locale}
            currentHp={state.instance.currentHp}
            maxHp={state.instance.initialHp}
            phaseName={
              phase
                ? t("phaseLabel", { position: phase.position + 1, name: phase.name })
                : ""
            }
          />
          {state.instance.endAt && state.instance.status === "active" ? (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-ink-faint" aria-hidden="true" />
              <CompetitionCountdown
                serverNowIso={serverNow}
                targetIso={state.instance.endAt}
                label={t("timeLeft", { time: "" }).replace(/:\s*$/, "")}
              />
            </div>
          ) : null}
          <p className="text-xs text-ink-faint">{t("serverTimeNote")}</p>
        </CardContent>
      </Card>

      {state.instance.status === "active" && gameSlug ? (
        <Card>
          <CardContent>
            <div className="flex flex-col gap-3">
              <PlayButton
                gameSlug={gameSlug}
                locale={locale}
                strings={{
                  play: t("attackNow"),
                  starting: tg("starting"),
                  failed: tg("startFailed"),
                }}
              />
              <BossStrikeButton
                locale={locale}
                instanceId={state.instance.id}
                attemptId={latest?.id ?? null}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <Trophy className="h-4 w-4" style={{ color: "var(--tap-warning-500)" }} aria-hidden="true" />
            {t("topDamage")}
          </h2>
          {state.top.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("emptySection")}</p>
          ) : (
            <ol className="flex flex-col gap-1 text-sm">
              {state.top.map((r, i) => (
                <li
                  key={r.name}
                  className={
                    r.isMe
                      ? "tap-row-mine flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                      : "flex items-center justify-between gap-2 px-2 py-1.5"
                  }
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="tap-boss-rank" aria-hidden="true">#{i + 1}</span>
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="font-bold">{r.damage}</span>
                </li>
              ))}
            </ol>
          )}
          {state.mine ? (
            <div className="mt-3 flex flex-col gap-1">
              <ProgressBar
                value={state.mine.damage}
                max={Math.max(state.instance.initialHp, 1)}
                label={t("myDamage", { damage: state.mine.damage })}
              />
              <p className="text-xs text-ink-muted">{t("myDamage", { damage: state.mine.damage })}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <Swords className="h-4 w-4 text-primary-500" aria-hidden="true" />
            {t("feedTitle")}
          </h2>
          {state.feed.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("emptySection")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {state.feed.map((f, i) => (
                <li key={`${f.createdAt}-${String(i)}`} className="flex items-center gap-2">
                  <Badge tone="neutral">{f.kind}</Badge>
                  <span className="text-ink-muted">{f.createdAt}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {finished ? (
        <Alert tone={defeated ? "success" : "warning"} title={defeated ? t("defeatedTitle") : t("expiredTitle")}>
          <span className="inline-flex items-center gap-1.5">
            <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
            {defeated ? t("defeatedBody") : t("expiredBody")}
          </span>
        </Alert>
      ) : null}
    </div>
  );
}
