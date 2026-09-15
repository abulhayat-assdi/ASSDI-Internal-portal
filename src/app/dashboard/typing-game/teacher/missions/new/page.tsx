import { PageHeader } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { getTeacherDashboard } from "@/lib/typing-game/server/staff-data";
import { CustomMissionForm } from "@/components/typing-game/custom-mission-form";

/** Teacher custom-mission creation: passage, completion rule, reward, batches. */
export default async function TeacherMissionNewPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <PageHeader title={t("createTitle")} />;
  const staffStore = createSupabaseStaffStore(client);
  const dashboard = await getTeacherDashboard(session.userId, staffStore);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("createTitle")} description={t("teacherHubSubtitle")} />
      <CustomMissionForm
        locale={locale}
        batches={dashboard.batches.map((b) => ({ id: b.batchId, name: b.batchName }))}
        initial={{
          title: "",
          description: "",
          passageText: "",
          completionMode: "once",
          timeLimitSeconds: null,
          repetitionsTarget: null,
          minAccuracy: null,
          minWpm: null,
          leaderboardMetric: "fastest_time",
          rewardXp: 50,
          rewardCoins: 10,
          batchIds: [],
        }}
      />
    </div>
  );
}
