import { notFound } from "next/navigation";
import { GAMES } from "@/lib/typing-game/content";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import type { Vars } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { createSupabaseAttemptStore } from "@/lib/typing-game/server/attempt-store";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { PlayExperience } from "@/components/typing-game/play-experience";
import { ResultScreen, type ResultStrings } from "@/components/typing-game/result-screen";

/**
 * Play route (M6). Server loads the attempt (ownership enforced), then either
 * replays a terminal result from stored state or mounts the live shell.
 */
export default async function PlayPage(
  props: {
    params: Promise<{ locale: string; attemptId: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const play = getTranslator(locale, "play");
  const result = getTranslator(locale, "result");
  const { session } = await studentContext(locale);
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  const store = createSupabaseAttemptStore(client);

  const attempt = await store.getAttempt(params.attemptId);
  if (!attempt || attempt.userId !== session.userId) notFound();
  const def = GAMES.find((g) => g.slug === attempt.gameSlug);
  if (!def) notFound();

  // Timing comes from the LIVE catalog row (the same source the submit route
  // enforces), with the static content definition as fallback. Using the
  // static def alone would let a DB timing change desync the countdown the
  // student sees from the limit the server actually enforces.
  const liveGame = await store.getActiveGame(attempt.gameSlug).catch(() => null);
  const timingKind = liveGame?.timingKind ?? def.timingRules.kind;
  const timingLimit = liveGame?.timingLimitSeconds ?? def.timingRules.limitSeconds ?? null;

  const gameTitle = locale === "bn" && def.title.bn ? def.title.bn : def.title.en;
  const links = {
    gameHref: `/student-dashboard/typing-game/games/${def.slug}`,
    mapHref: `/student-dashboard/typing-game/map`,
    dashboardHref: `/student-dashboard/typing-game/dashboard`,
  };

  if (attempt.status === "validated") {
    const stored = await store.getResult(attempt.id);
    if (stored) {
      return (
        <ResultScreen
          result={{
            score: stored.score,
            accuracy: stored.accuracy,
            effectiveWpm: stored.effectiveWpm,
            progression: null,
          }}
          snap={null}
          isPB={false}
          strings={resultStrings(result)}
          gameHref={links.gameHref}
          mapHref={links.mapHref}
          dashboardHref={links.dashboardHref}
          visual={def.theme.visual}
        />
      );
    }
  }

  if (attempt.status !== "started" && attempt.status !== "in_progress") {
    notFound();
  }

  return (
    <PlayExperience
      attemptId={attempt.id}
      gameSlug={def.slug}
      gameTitle={gameTitle}
      expectedText={attempt.expectedText}
      timingKind={timingKind}
      timingLimit={timingLimit}
      visual={def.theme.visual}
      mechanic={def.mechanic}
      strings={{
        play: {
          tapToFocus: play("tapToFocus"),
          timeLeft: play("timeLeft"),
          wpm: play("wpm"),
          accuracy: play("accuracy"),
          combo: play("combo"),
          progress: play("progress"),
          pause: play("pause"),
          resume: play("resume"),
          restart: play("restart"),
          quit: play("quit"),
          submitting: play("submitting"),
          expired: play("expired"),
          failedToSubmit: play("failedToSubmit"),
          focusLost: play("focusLost"),
          screenReaderProgress: play("screenReaderProgress"),
          mechanicCheckpoints: play("mechanicCheckpoints"),
          mechanicRelay: play("mechanicRelay"),
          mechanicChain: play("mechanicChain"),
          mechanicWaves: play("mechanicWaves"),
          mechanicShield: play("mechanicShield"),
          mechanicTargets: play("mechanicTargets"),
        },
        result: resultStrings(result),
      }}
      gameHref={links.gameHref}
      mapHref={links.mapHref}
      dashboardHref={links.dashboardHref}
    />
  );
}

function resultStrings(t: (key: keyof ResultStrings, vars?: Vars) => string) {
  return {
    title: t("title"),
    subtitle: t("subtitle"),
    wpm: t("wpm"),
    accuracy: t("accuracy"),
    score: t("score"),
    duration: t("duration"),
    errors: t("errors"),
    corrected: t("corrected"),
    personalBest: t("personalBest"),
    xpEarned: t("xpEarned"),
    coinsEarned: t("coinsEarned"),
    levelUp: t("levelUp"),
    badgeEarned: t("badgeEarned"),
    streakKept: t("streakKept"),
    unlocked: t("unlocked"),
    playAgain: t("playAgain"),
    backToMap: t("backToMap"),
    continueAdventure: t("continueAdventure"),
    rejectedTitle: t("rejectedTitle"),
    rejectedDescription: t("rejectedDescription"),
    expiredTitle: t("expiredTitle"),
    expiredDescription: t("expiredDescription"),
  };
}
