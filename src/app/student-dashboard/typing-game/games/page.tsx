import { PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { recommendGame } from "@/lib/typing-game/server/student";
import { enrichGames } from "@/lib/typing-game/server/games";
import { GamesExplorer } from "@/components/typing-game/games-explorer";

export default async function GamesPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "games");
  const { session, store } = await studentContext(locale);

  const [games, worlds, unlocks, completed] = await Promise.all([
    enrichGames(session.userId, store),
    store.listWorlds(),
    store.listUnlocks(session.userId),
    store.listCompletedGames(session.userId),
  ]);
  const recommended = recommendGame(
    games,
    unlocks,
    completed,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <GamesExplorer
        locale={locale}
        games={games}
        worlds={worlds.map((w) => ({
          slug: w.slug,
          name: locale === "bn" && w.nameBn ? w.nameBn : w.nameEn,
        }))}
        modes={[...new Set(games.map((g) => g.mode))].sort()}
        recommendedSlug={recommended?.slug ?? null}
        strings={{
          search: t("search"),
          searchPlaceholder: t("searchPlaceholder"),
          filterWorld: t("filterWorld"),
          filterDifficulty: t("filterDifficulty"),
          filterMode: t("filterMode"),
          filterStatus: t("filterStatus"),
          statusAll: t("statusAll"),
          statusUnlocked: t("statusUnlocked"),
          statusLocked: t("statusLocked"),
          statusCompleted: t("statusCompleted"),
          sortBy: t("sortBy"),
          sortRecommended: t("sortRecommended"),
          sortEasiest: t("sortEasiest"),
          sortBest: t("sortBest"),
          noResults: t("noResults"),
          play: t("play"),
          lockedReason: t("lockedReason"),
          viewDetails: t("viewDetails"),
          bestScore: t("bestScore"),
          beginner: t("difficultyBeginner"),
          intermediate: t("difficultyIntermediate"),
          expert: t("difficultyExpert"),
          adUnlock: t("adUnlock"),
          adUnlockHint: t("adUnlockHint"),
          adUnlocking: t("adUnlocking"),
          adUnlockFailed: t("adUnlockFailed"),
        }}
      />
    </div>
  );
}
