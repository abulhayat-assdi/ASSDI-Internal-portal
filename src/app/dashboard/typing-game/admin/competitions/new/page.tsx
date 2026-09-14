import { PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { createSupabaseStudentStore } from "@/lib/typing-game/server/student-store";
import { competitionPageContext } from "@/lib/typing-game/server/competition-pages";
import { CompetitionForm } from "@/components/typing-game/competition-form";

/** Admin competition creation across scoped batches. */
export default async function AdminCompetitionNewPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "competitions");
  await competitionPageContext(locale);
  const client = await userDbClient();
  if (!client) return <PageHeader title={t("createTitle")} />;
  const { orgIds } = await requireAdmin(client);
  const [batches, games] = await Promise.all([
    createSupabaseStaffStore(client).listBatches(orgIds),
    createSupabaseStudentStore(client).listGames(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("createTitle")} />
      <CompetitionForm        locale={locale}
        games={games.map((g) => ({
          slug: g.slug,
          title: g.slug,
        }))}
        batches={batches.map((b) => ({ id: b.id, name: b.name }))}
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
    </div>
  );
}
