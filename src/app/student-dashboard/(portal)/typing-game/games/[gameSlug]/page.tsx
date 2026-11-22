import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Gauge, Lock, Sparkles, Trophy } from "lucide-react";
import { Badge, Card, CardContent, LockedGameCard, cx } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { getGameDetails } from "@/lib/typing-game/server/games";
import { GAMES } from "@/lib/typing-game/content";
import { worldVisual } from "@/lib/typing-game/world-visuals";
import { PlayButton } from "@/components/typing-game/play-button";
import { AdUnlockButton } from "@/components/typing-game/ad-unlock-button";

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
    <div className="flex flex-col gap-4">
      <Link href="/student-dashboard/typing-game/games" className="tap-link-btn w-fit text-sm">
        ← সব গেম
      </Link>
      {/* Wide screens: the game's banner on the left, playing it on the right. */}
      <div className="grid items-stretch gap-6 lg:grid-cols-[1.6fr_1fr]" style={{ minHeight: "calc(100dvh - 15rem)" }}>
      <div data-visual={visual} className="flex">
        <div
          className={cx("tap-hero-banner flex w-full flex-col justify-center", !game.unlocked && "tap-hero-banner-locked")}
          style={{ minHeight: "16rem" }}
        >
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
              {game.adUnlockAvailable ? (
                <AdUnlockButton
                  slug={game.slug}
                  strings={{
                    adUnlock: t("adUnlock"),
                    adUnlockHint: t("adUnlockHint"),
                    adUnlocking: t("adUnlocking"),
                    adUnlockFailed: t("adUnlockFailed"),
                    adModalTitle: t("adModalTitle"),
                    adModalBody: t("adModalBody"),
                    adWatching: t("adWatching"),
                    adClaim: t("adClaim"),
                    adCancel: t("adCancel"),
                    adSponsored: t("adSponsored"),
                    adReady: t("adReady"),
                  }}
                />
              ) : null}
            </div>
          }
        />
      ) : (
        <Card className="flex h-full flex-col">
          <CardContent className="flex flex-1 flex-col justify-between gap-6">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Gauge className="h-10 w-10 text-primary-500" aria-hidden="true" />
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
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-ink-faint">Level</dt>
                <dd className="font-semibold">{diffLabel(game.difficulty)}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Mode</dt>
                <dd className="font-semibold capitalize">{game.mode}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Type</dt>
                <dd className="font-semibold capitalize">{game.category}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Best score</dt>
                <dd className="font-semibold tabular-nums">{game.bestScore ?? "—"}</dd>
              </div>
            </dl>
            <ul className="flex flex-col gap-1.5 rounded-xl p-3 text-sm text-ink-muted" style={{ background: "var(--tap-surface)" }}>
              <li>• আঙুল হোম রো-তে (ASDF / JKL;) রেখে শুরু করুন</li>
              <li>• আগে নির্ভুলতা, তারপর গতি</li>
              <li>• খেলা শেষে XP পাবেন — সেরা স্কোর ভাঙার চেষ্টা করুন</li>
            </ul>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
