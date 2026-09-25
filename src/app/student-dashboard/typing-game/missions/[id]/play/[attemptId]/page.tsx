import { notFound, redirect } from "next/navigation";
import { DEFAULT_LOCALE, getTranslator } from "@/lib/typing-game/i18n";
import type { Vars } from "@/lib/typing-game/i18n";
import { customMissionPageContext } from "@/lib/typing-game/server/custom-mission-pages";
import {
  CustomMissionPlayExperience,
  type CustomMissionStrings,
} from "@/components/typing-game/custom-mission-play";
import type { ResultStrings } from "@/components/typing-game/result-screen";
import { buildPlayStrings } from "@/components/typing-game/play-strings";
import { buildResultStrings } from "@/components/typing-game/result-strings";
import type { MissionsTranslator } from "@/lib/typing-game/custom-mission-ui";

/**
 * Play route for a custom-mission attempt. The attempt was already minted
 * by POST .../attempts/start (see StartCustomMissionButton); this route just
 * loads its expected-text snapshot and mounts the shared typing shell.
 * Terminal attempts (already validated/rejected/expired) have nothing left
 * to replay here — the mission's own store has no per-attempt result
 * lookup — so they bounce back to the mission detail page.
 */
export default async function CustomMissionPlayPage(props: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = await props.params;
  const locale = DEFAULT_LOCALE;
  const play = getTranslator(locale, "play");
  const result = getTranslator(locale, "result");
  const missions = getTranslator(locale, "missions");
  const { session, store } = await customMissionPageContext(locale);

  const mission = await store.getAssigned(id);
  if (!mission) notFound();

  const missionHref = `/student-dashboard/typing-game/missions/${id}`;
  const attempt = await store.getAttempt(attemptId);
  if (!attempt || attempt.missionId !== id) notFound();
  if (attempt.status !== "started") redirect(missionHref);

  const timingKind = mission.completionMode === "timed" ? "countdown" : "untimed";
  const timingLimit = mission.completionMode === "timed" ? mission.timeLimitSeconds : null;

  return (
    <CustomMissionPlayExperience
      userId={session.userId}
      missionId={mission.id}
      attemptId={attempt.id}
      missionTitle={mission.title}
      expectedText={attempt.expectedText}
      timingKind={timingKind}
      timingLimit={timingLimit}
      completionMode={mission.completionMode}
      repetitionsTarget={mission.repetitionsTarget}
      strings={{
        play: buildPlayStrings(play),
        result: { ...buildResultStrings(result), playAgain: missions("retryMission") },
        mission: missionStrings(missions),
      }}
      missionHref={missionHref}
      missionsHref="/student-dashboard/typing-game/missions"
      leaderboardHref={`${missionHref}/leaderboard`}
      dashboardHref="/student-dashboard/typing-game/dashboard"
    />
  );
}



function missionStrings(t: MissionsTranslator): CustomMissionStrings {
  return {
    qualifiedBadge: t("qualifiedBadge"),
    notQualifiedBadge: t("notQualifiedBadge"),
    missionCompleteBadge: t("missionCompleteBadge"),
    repetitionsProgress: t("repetitionsProgress"),
    keepGoingBody: t("keepGoingBody"),
    viewLeaderboard: t("viewLeaderboard"),
  };
}
