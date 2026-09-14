import { notFound } from "next/navigation";
import { isLocale, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { competitionPageContext } from "@/lib/typing-game/server/competition-pages";
import { CompetitionManage } from "@/components/typing-game/competition-details";

/** Teacher competition management: actions + board + draft editing. */
export default async function TeacherCompetitionManagePage(
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
    <CompetitionManage
      locale={locale}
      detail={detail}
      board={board}
      baseHref={`/dashboard/typing-game/teacher/competitions`}
    />
  );
}
