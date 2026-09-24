/**
 * One place that turns the "play" namespace into PlayStrings.
 *
 * Both play routes (catalog games and custom missions) mounted their own
 * copy of this mapping, so every new key had to be added twice and the two
 * drifted. Building it here means a mechanic HUD string is wired once.
 */
import type { Messages, Vars } from "@/lib/typing-game/i18n";
import type { PlayStrings } from "./game-player";
import type { MechanicStageStrings } from "./mechanics/mechanic-stage";

export type PlayTranslator = (
  key: keyof Messages["play"] & string,
  vars?: Vars,
) => string;

export function buildStageStrings(t: PlayTranslator): MechanicStageStrings {
  return {
    lives: t("stageLives"),
    shield: t("stageShield"),
    waves: t("stageWaves"),
    checkpoints: t("stageCheckpoints"),
    targets: t("stageTargets"),
    chain: t("stageChain"),
    bossHp: t("stageBossHp"),
    distance: t("stageDistance"),
    pursuer: t("stagePursuer"),
    caught: t("endCaught"),
    outOfLives: t("endOutOfLives"),
    shieldBroken: t("endShieldBroken"),
    checkpointMissed: t("endCheckpointMissed"),
    bossSurvived: t("endBossSurvived"),
  };
}

export function buildPlayStrings(t: PlayTranslator): PlayStrings {
  return {
    tapToFocus: t("tapToFocus"),
    timeLeft: t("timeLeft"),
    wpm: t("wpm"),
    accuracy: t("accuracy"),
    combo: t("combo"),
    progress: t("progress"),
    pause: t("pause"),
    resume: t("resume"),
    restart: t("restart"),
    quit: t("quit"),
    submitting: t("submitting"),
    expired: t("expired"),
    failedToSubmit: t("failedToSubmit"),
    focusLost: t("focusLost"),
    screenReaderProgress: t("screenReaderProgress"),
    mechanicCheckpoints: t("mechanicCheckpoints"),
    mechanicRelay: t("mechanicRelay"),
    mechanicChain: t("mechanicChain"),
    mechanicWaves: t("mechanicWaves"),
    mechanicShield: t("mechanicShield"),
    mechanicTargets: t("mechanicTargets"),
    stage: buildStageStrings(t),
  };
}
