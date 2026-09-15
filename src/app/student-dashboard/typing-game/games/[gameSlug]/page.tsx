import { notFound } from "next/navigation";
import { CheckCircle2, Gauge, Lock, Sparkles, Trophy } from "lucide-react";
import { Badge, Card, CardContent, LockedGameCard, cx } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { getGameDetails } from "@/lib/typing-game/server/games";
import { GAMES } from "@/lib/typing-game/content";
import { worldVisual } from "@/lib/typing-game/world-visuals";
import { PlayButton } from "@/components/typing-game/play-button";

const GAME_VISUAL = new Map(GAMES.map((g) => [g.slug, g.theme.visual]));

export default async function GameDetailPage(
  props: {
    params: Promise<{ locale: string; gameSlug: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "games");
  const { session, store } = await studentContext(locale);
  const game = await getGameDetails(session.userId, params.gameSlug, store);
  if (!game) notFound();

  const title = locale === "bn" && game.titleBn ? game.titleBn : game.titleEn;
  const visual = GAME_VISUAL.get(game.slug) ?? worldVisual(game.worldSlug);
  const diffLabel = (d: string): string =>
    d === "beginner"
      ? t("difficultyBeginner")
      : d === "intermediate"
        ? t("difficultyIntermediate")
        : t("difficultyExpert");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div data-visual={visual}>
        <div className={cx("tap-hero-banner", !game.unlocked && "tap-hero-banner-locked")}>
          <p className="tap-hero-eyebrow">
            {game.unlocked ? <Sparkles className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {game.mode} · {game.category}
          </p>
          <h1 className="tap-hero-title">{title}</h1>
          <p className="tap-hero-desc">{game.descriptionEn}</p>
          <div className="tap-hero-meta">
            <span className="tap-chip">{diffLabel(game.difficulty)}</span>
            {game.completed ? (
              <span className="tap-chip">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("statusCompleted")}
              </span>
            ) : null}
            {game.bestScore !== null ? (
              <span className="tap-chip">
                <Trophy className="h-3.5 w-3.5" /> {t("bestScore")}: {game.bestScore}
              </span>
            ) : null}
            {!game.unlocked ? (
              <span className="tap-chip">
                <Lock className="h-3.5 w-3.5" /> {t("lockedReason")}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {!game.unlocked ? (
        <LockedGameCard
          title={title}
          whyLocked={game.lockedReasons}
          action={
            <div className="flex flex-wrap gap-2">
              <Badge tone="warning">{t("lockedReason")}</Badge>
              <Badge tone="neutral">{diffLabel(game.difficulty)}</Badge>
              <Badge tone="neutral">{game.mode}</Badge>
            </div>
          }
        />
      ) : (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <Gauge className="h-8 w-8 text-primary-500" aria-hidden="true" />
              <PlayButton
                gameSlug={game.slug}
                locale={locale}
                strings={{
                  play: t("play"),
                  starting: t("starting"),
                  failed: t("startFailed"),
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
