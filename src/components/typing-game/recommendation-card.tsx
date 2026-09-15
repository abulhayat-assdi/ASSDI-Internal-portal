import Link from "next/link";
import { Compass, Sparkles } from "lucide-react";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import type { AdaptiveRecommendation } from "@/lib/typing-game/server/adaptive-store";
import { GAMES } from "@/lib/typing-game/content";
import { worldVisual } from "@/lib/typing-game/world-visuals";

const GAME_VISUAL = new Map(GAMES.map((g) => [g.slug, g.theme.visual]));
const WORLD_OF_GAME = new Map(GAMES.map((g) => [g.slug, g.worldSlug]));
function visualForGame(slug: string): string {
  return GAME_VISUAL.get(slug) ?? worldVisual(WORLD_OF_GAME.get(slug) ?? "");
}

/** One recommendation card: mission-like framing + why + start link. */
export function RecommendationCard({
  locale,
  recommendation,
}: {
  locale: Locale;
  recommendation: AdaptiveRecommendation;
}) {
  const t = getTranslator(locale, "adaptive");
  return (
    <div data-visual={visualForGame(recommendation.gameSlug)}>
      <div className="tap-recommend-banner">
        <p className="tap-hero-eyebrow">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" /> {t("recommendedTitle")}
        </p>
        <p className="relative mt-1 text-base font-bold">{recommendation.message}</p>
        <p className="relative mt-1 text-sm text-white/85">
          {t("skillFocus")}:{" "}
          {recommendation.targets.length > 0
            ? recommendation.targets.join(", ")
            : recommendation.reason}
        </p>
        <p className="relative text-sm text-white/85">
          {t("expectedBenefit")}: {recommendation.benefit}
        </p>
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={`/student-dashboard/typing-game/games/${recommendation.gameSlug}`}
            className="tap-btn tap-btn-primary tap-btn-sm"
          >
            {t("startPractice")}
          </Link>
          <span className="tap-chip" title={t("whySeeing")}>
            {recommendation.reason}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Dashboard widget: the single recommended next step. */
export function RecommendedNext({
  locale,
  recommendation,
}: {
  locale: Locale;
  recommendation: AdaptiveRecommendation | null;
}) {
  const t = getTranslator(locale, "adaptive");
  if (!recommendation) return null;
  return (
    <div data-visual={visualForGame(recommendation.gameSlug)}>
      <div className="tap-recommend-banner">
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="tap-hero-eyebrow">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t("recommendedTitle")}
            </p>
            <p className="mt-1 text-base font-bold">{recommendation.message}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/student-dashboard/typing-game/games/${recommendation.gameSlug}`}
              className="tap-btn tap-btn-primary tap-btn-sm"
            >
              {t("startPractice")}
            </Link>
            <Link
              href={`/student-dashboard/typing-game/recommended`}
              className="tap-btn tap-btn-secondary tap-btn-sm"
            >
              {t("whySeeing")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
