import { notFound, redirect } from "next/navigation";
import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import {
  createSupabaseCustomMissionStore,
  isRecord,
} from "@/lib/typing-game/server/custom-mission-store";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { getTeacherDashboard } from "@/lib/typing-game/server/staff-data";
import { CustomMissionForm } from "@/components/typing-game/custom-mission-form";

/** Draft-only edit: same wizard as create, prefilled + PATCHed. */
export default async function TeacherMissionEditPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <PageHeader title={t("editMission")} />;

  const store = createSupabaseCustomMissionStore(client);
  const mission = await store.getForManage(id);
  if (!mission) notFound();
  if (mission.status !== "draft") {
    redirect(`/dashboard/typing-game/teacher/missions/${id}`);
  }

  const batchRowsRes = await client
    .from("custom_mission_batches")
    .select("batch_id")
    .eq("mission_id", id);
  const assignedBatchIds = Array.isArray(batchRowsRes.data)
    ? batchRowsRes.data
        .filter(isRecord)
        .map((r) => (typeof r.batch_id === "string" ? r.batch_id : ""))
        .filter(Boolean)
    : [];

  const staffStore = createSupabaseStaffStore(client);
  const dashboard = await getTeacherDashboard(session.userId, staffStore);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("editMission")} description={mission.title} />
      <Card>
        <CardContent>
          <CustomMissionForm
        locale={locale}
        batches={dashboard.batches.map((b) => ({ id: b.batchId, name: b.batchName }))}
        initial={{
          id: mission.id,
          title: mission.title,
          description: mission.description,
          passageText: mission.passageText,
          completionMode: mission.completionMode,
          timeLimitSeconds: mission.timeLimitSeconds,
          repetitionsTarget: mission.repetitionsTarget,
          minAccuracy: mission.minAccuracy,
          minWpm: mission.minWpm,
          leaderboardMetric: mission.leaderboardMetric,
          rewardXp: mission.rewardXp,
          rewardCoins: mission.rewardCoins,
          batchIds: assignedBatchIds,
        }}
      />
        </CardContent>
      </Card>
    </div>
  );
}
