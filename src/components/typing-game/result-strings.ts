/**
 * One place that turns the "result" namespace into ResultStrings.
 *
 * Both play routes carried their own copy keyed on `keyof ResultStrings`,
 * so every new field had to be added in three places and a miss only showed
 * up as a type error at the call site. Built once here instead.
 */
import type { Messages, Vars } from "@/lib/typing-game/i18n";
import type { ResultStrings } from "./result-screen";

export type ResultTranslator = (
  key: keyof Messages["result"] & string,
  vars?: Vars,
) => string;

export function buildResultStrings(t: ResultTranslator): ResultStrings {
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
    mechanicTitle: t("mechanicTitle"),
    mechanicCleared: t("mechanicCleared"),
    mechanicNotCleared: t("mechanicNotCleared"),
    mechanicUnits: t("mechanicUnits"),
    mechanicLivesLost: t("mechanicLivesLost"),
  };
}
