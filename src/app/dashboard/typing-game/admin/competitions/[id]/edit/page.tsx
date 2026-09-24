import { notFound } from "next/navigation";
import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { createSupabaseStudentStore } from "@/lib/typing-game/server/student-store";
import { competitionPageContext } from "@/lib/typing-game/server/competition-pages";
import { CompetitionForm } from "@/components/typing-game/competition-form";

/** Admin draft editing. Only drafts reach here; later states 404 the form. */
export default async function AdminCompetitionEditPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "competitions");
  const { session, store } = await competitionPageContext(locale);
  const detail = await store.getCompetition(params.id, session.userId);
  if (!detail || detail.status !== "draft") notFound();

  const client = await userDbClient();
  if (!client) return <PageHeader title={t("editDraft")} />;
  // Admin scope (org-wide batches), not the teacher's own assignments; the
  // layout already ran requireAdmin, this narrows the batch list to org scope.
  const { orgIds } = await requireAdmin(client);
  const [batches, games] = await Promise.all([
    createSupabaseStaffStore(client).listBatches(orgIds),
    createSupabaseStudentStore(client).listGames(),
  ]);
  const xp =
    typeof detail.rewardPolicy.xp === "object" &&
    detail.rewardPolicy.xp !== null
      ? (detail.rewardPolicy.xp as Record<string, unknown>)
      : {};

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("editDraft")} description={detail.title} />
      <Card>
        <CardContent>
          <CompetitionForm
            locale={locale}
            baseHref="/dashboard/typing-game/admin/competitions"
            games={games.map((g) => ({
              slug: g.slug,
              title: g.slug,
            }))}
            batches={batches.map((b) => ({ id: b.id, name: b.name }))}
            initial={{
              id: detail.id,
              slug: detail.slug,
              title: detail.title,
              description: detail.description,
              gameSlugs: detail.gameSlugs,
              startsAt: detail.startsAt,
              endsAt: detail.endsAt,
              attemptLimit: detail.attemptLimit,
              attemptPolicy: detail.attemptPolicy,
              winnerXp: typeof xp["1"] === "number" ? xp["1"] : 0,
              participationXp:
                typeof xp.participation === "number" ? xp.participation : 0,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
