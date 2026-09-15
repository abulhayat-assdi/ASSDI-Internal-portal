"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/typing-game/ui";
import type { CompletionMode } from "@/lib/typing-game/server/custom-mission-store";
import {
  GamePlayer,
  type PlayStrings,
  type SubmitSnapshot,
  type ValidatedResult,
} from "./game-player";
import { ResultScreen, type ResultStrings } from "./result-screen";

export interface CustomMissionStrings {
  qualifiedBadge: string;
  notQualifiedBadge: string;
  missionCompleteBadge: string;
  repetitionsProgress: string;
  keepGoingBody: string;
  viewLeaderboard: string;
}

interface LeaderboardRowShape {
  userId: string;
  qualifyingAttempts: number;
}

function isLeaderboardBody(v: unknown): v is { rows: LeaderboardRowShape[] } {
  if (typeof v !== "object" || v === null) return false;
  const rows = (v as { rows?: unknown }).rows;
  return Array.isArray(rows);
}

/**
 * Orchestrates play -> submit -> server-truth result for a teacher-authored
 * custom mission. Reuses GamePlayer (typing shell) and ResultScreen (numbers
 * display) untouched — only the submit endpoint and the post-result
 * messaging (qualifies/completed/newlyCompleted) are mission-specific.
 */
export function CustomMissionPlayExperience({
  userId,
  missionId,
  attemptId,
  missionTitle,
  expectedText,
  timingKind,
  timingLimit,
  completionMode,
  repetitionsTarget,
  strings,
  missionHref,
  missionsHref,
  leaderboardHref,
  dashboardHref,
}: {
  userId: string;
  missionId: string;
  attemptId: string;
  missionTitle: string;
  expectedText: string;
  timingKind: string;
  timingLimit: number | null;
  completionMode: CompletionMode;
  repetitionsTarget: number | null;
  strings: {
    play: PlayStrings;
    result: ResultStrings;
    mission: CustomMissionStrings;
  };
  missionHref: string;
  missionsHref: string;
  leaderboardHref: string;
  dashboardHref: string;
}) {
  const [done, setDone] = useState<{
    result: ValidatedResult;
    snap: SubmitSnapshot;
  } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [rejected, setRejected] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  if (done) {
    const { result } = done;
    const banner = result.newlyCompleted ? (
      <Alert tone="success" title={strings.mission.missionCompleteBadge}>
        <Link href={leaderboardHref} className="tap-btn tap-btn-secondary tap-btn-sm">
          {strings.mission.viewLeaderboard}
        </Link>
      </Alert>
    ) : result.qualifies ? (
      <Alert tone="info" title={strings.mission.qualifiedBadge}>
        {completionMode === "repetitions" && progress
          ? strings.mission.repetitionsProgress
              .replace("{done}", String(progress.done))
              .replace("{total}", String(progress.total))
          : strings.mission.keepGoingBody}
      </Alert>
    ) : (
      <Alert tone="warning" title={strings.mission.notQualifiedBadge}>
        {strings.mission.keepGoingBody}
      </Alert>
    );
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {banner}
        <ResultScreen
          result={result}
          snap={done.snap}
          isPB={false}
          strings={strings.result}
          gameHref={missionHref}
          mapHref={missionsHref}
          dashboardHref={dashboardHref}
        />
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <Alert tone="warning" title={strings.result.rejectedTitle}>
          {strings.result.rejectedDescription.replace("{reason}", rejected)}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Link href={missionHref} className="tap-btn tap-btn-secondary tap-btn-md">
            {strings.result.playAgain}
          </Link>
          <Link href={missionsHref} className="tap-btn tap-btn-primary tap-btn-md">
            {strings.result.backToMap}
          </Link>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <Alert tone="warning" title={strings.result.expiredTitle}>
          {strings.result.expiredDescription}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Link href={missionHref} className="tap-btn tap-btn-secondary tap-btn-md">
            {strings.result.playAgain}
          </Link>
          <Link href={missionsHref} className="tap-btn tap-btn-primary tap-btn-md">
            {strings.result.backToMap}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <GamePlayer
      attemptId={attemptId}
      gameSlug="custom-mission"
      gameTitle={missionTitle}
      expectedText={expectedText}
      timingKind={timingKind}
      timingLimit={timingLimit}
      visual="vault"
      mechanic="accuracy-trial"
      strings={strings.play}
      backHref={missionHref}
      submitUrl={`/api/typing-game/custom-missions/${encodeURIComponent(missionId)}/attempts/${encodeURIComponent(attemptId)}/submit`}
      onDone={(result, snap, extra) => {
        if (result) {
          setDone({ result, snap });
          if (completionMode === "repetitions") {
            void fetch(
              `/api/typing-game/custom-missions/${encodeURIComponent(missionId)}/leaderboard`,
              { credentials: "same-origin" },
            )
              .then((r) => (r.ok ? r.json() : null))
              .then((body: unknown) => {
                if (!isLeaderboardBody(body)) return;
                const row = body.rows.find((r) => r.userId === userId);
                if (row) {
                  setProgress({
                    done: row.qualifyingAttempts,
                    total: repetitionsTarget ?? row.qualifyingAttempts,
                  });
                }
              })
              .catch(() => {
                // Best-effort context only — the completion badge above
                // already reflects the server-truth qualifies/completed
                // flags regardless of whether this lookup succeeds.
              });
          }
        } else if (extra.expired) {
          setExpired(true);
        } else {
          setRejected(extra.rejectedReason ?? "REJECTED");
        }
      }}
    />
  );
}
