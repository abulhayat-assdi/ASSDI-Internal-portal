import { notFound } from "next/navigation";
import { Trophy, Users } from "lucide-react";
import { Card, CardContent, PageHeader, SectionHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { seasonPageContext } from "@/lib/typing-game/server/season-pages";
import { SeasonBoard } from "@/components/typing-game/season-board";

/** Full leaderboards for the active (or latest) season. */
export default async function SeasonLeaderboardPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "seasons");
  const { session, store } = await seasonPageContext(locale);
  const seasons = await store.listSeasons();
  const active = seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
  if (!active) notFound();
  const [student, clan] = await Promise.all([
    store.getBoard(active.id, "student"),
    store.getBoard(active.id, "clan"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={active.name} description={active.theme} />
      <Card>
        <CardContent>
          <SectionHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Trophy className="h-4 w-4" style={{ color: "var(--tap-warning-500)" }} aria-hidden="true" />
                {t("sectionStudentBoard")}
              </span>
            }
          />
          <SeasonBoard locale={locale} rows={student} clan={false} meId={session.userId} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SectionHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: "var(--tap-primary-500)" }} aria-hidden="true" />
                {t("sectionClanBoard")}
              </span>
            }
          />
          <SeasonBoard locale={locale} rows={clan} clan={true} />
        </CardContent>
      </Card>
    </div>
  );
}
