import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { createSupabaseStudentStore } from "@/lib/typing-game/server/student-store";
import { getTeacherDashboard } from "@/lib/typing-game/server/staff-data";
import { CompetitionForm } from "@/components/typing-game/competition-form";

/** Teacher competition creation (assigned batches + game catalog). */
export default async function TeacherCompetitionNewPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "competitions");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <PageHeader title={t("createTitle")} />;
  const staffStore = createSupabaseStaffStore(client);
  const studentStore = createSupabaseStudentStore(client);
  const [dashboard, games] = await Promise.all([
    getTeacherDashboard(session.userId, staffStore),
    studentStore.listGames(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("createTitle")} />
      <Card>
        <CardContent>
          <CompetitionForm
        locale={locale}
        games={games.map((g) => ({
          slug: g.slug,
          title: g.slug,
        }))}
        batches={dashboard.batches.map((b) => ({
          id: b.batchId,
          name: b.batchName,
        }))}
        initial={{
          slug: "",
          title: "",
          description: "",
          gameSlugs: [],
          startsAt: "",
          endsAt: "",
          attemptLimit: 3,
          attemptPolicy: "BEST_SCORE",
          winnerXp: 100,
          participationXp: 10,
        }}
      />
        </CardContent>
      </Card>
    </div>
  );
}
