import { notFound } from "next/navigation";
import { isLocale, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { competitionPageContext } from "@/lib/typing-game/server/competition-pages";
import { CompetitionDetails } from "@/components/typing-game/competition-details";

/**
 * Student competition details. Everything shown is server-authoritative:
 * detail + own entry (RLS), server-derived board, server clock for the
 * countdown anchor. Live entry reuses the game play route (no second
 * runtime); attaching the validated attempt happens via the API.
 */
export default async function CompetitionDetailPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const { session, store } = await competitionPageContext(locale);
  const detail = await store.getCompetition(params.id, session.userId);
  if (!detail) notFound();
  const board = await store.getLeaderboard(detail.id);

  return (
    <CompetitionDetails
      locale={locale}
      detail={detail}
      board={board}
      serverNowIso={new Date().toISOString()}
      gameSlug={detail.gameSlugs[0] ?? null}
    />
  );
}
