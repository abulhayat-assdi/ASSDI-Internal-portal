import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  PageHeader,
  SectionHeader,
  Tabs,
  type BadgeTone,
} from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import {
  createSupabaseCustomMissionStore,
  isRecord,
} from "@/lib/typing-game/server/custom-mission-store";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { formatDateTime } from "@/lib/typing-game/competitions";
import { leaderboardMetricKey, missionStatusKey } from "@/lib/typing-game/custom-missions";
import { CustomMissionLifecycleActions } from "@/components/typing-game/custom-mission-lifecycle-actions";
import {
  CustomMissionLeaderboardTable,
  CustomMissionRosterTable,
} from "@/components/typing-game/custom-mission-tables";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  active: "success",
  archived: "warning",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="font-bold">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Teacher custom-mission detail: rules, reward, batches, roster, leaderboard. */
export default async function TeacherMissionDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <PageHeader title={t("teacherHubTitle")} />;

  const store = createSupabaseCustomMissionStore(client);
  const mission = await store.getForManage(id);
  if (!mission) notFound();

  const [roster, leaderboard, batchRowsRes] = await Promise.all([
    store.getRoster(id),
    store.getLeaderboard(id),
    client.from("custom_mission_batches").select("batch_id").eq("mission_id", id),
  ]);

  const assignedBatchIds = Array.isArray(batchRowsRes.data)
    ? batchRowsRes.data
        .filter(isRecord)
        .map((r) => (typeof r.batch_id === "string" ? r.batch_id : ""))
        .filter(Boolean)
    : [];
  const staffStore = createSupabaseStaffStore(client);
  const batchInfos = await Promise.all(
    assignedBatchIds.map((batchId) => staffStore.batchInfo(batchId)),
  );
  const batchNames = batchInfos
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .map((b) => b.name);

  const ruleText =
    mission.completionMode === "timed"
      ? t("ruleTimedSummary", { seconds: mission.timeLimitSeconds ?? 0 })
      : mission.completionMode === "repetitions"
        ? t("ruleRepsSummary", { count: mission.repetitionsTarget ?? 0 })
        : t("ruleOnceSummary");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/typing-game/teacher/missions"
        className="inline-flex w-fit items-center gap-1 text-sm text-ink-muted"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("backToMissions")}
      </Link>

      <PageHeader
        title={mission.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[mission.status] ?? "neutral"}>
              {t(missionStatusKey(mission.status))}
            </Badge>
            <span className="text-xs text-ink-faint">
              {formatDateTime(mission.createdAt, locale)}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {mission.status === "draft" ? (
              <Link
                href={`/dashboard/typing-game/teacher/missions/${mission.id}/edit`}
                className="tap-btn tap-btn-secondary"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                <span>{t("editMission")}</span>
              </Link>
            ) : null}
            <CustomMissionLifecycleActions
              locale={locale}
              missionId={mission.id}
              status={mission.status}
            />
          </div>
        }
      />

      <Card>
        <CardContent>
          <dl className="flex flex-col gap-1">
            <DetailRow label={t("detailsRule")} value={ruleText} />
            {mission.minAccuracy !== null ? (
              <DetailRow
                label={t("fieldMinAccuracy")}
                value={t("minAccuracySummary", { value: mission.minAccuracy })}
              />
            ) : null}
            {mission.minWpm !== null ? (
              <DetailRow
                label={t("fieldMinWpm")}
                value={t("minWpmSummary", { value: mission.minWpm })}
              />
            ) : null}
            <DetailRow
              label={t("detailsReward")}
              value={t("rewardSummary", { xp: mission.rewardXp, coins: mission.rewardCoins })}
            />
            <DetailRow label={t("fieldLeaderboardMetric")} value={t(leaderboardMetricKey(mission.leaderboardMetric))} />
            <DetailRow
              label={t("detailsBatchesAssigned")}
              value={batchNames.length > 0 ? batchNames.join(", ") : t("noBatchesAssigned")}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader title={t("detailsPassage")} />
          <p className="whitespace-pre-wrap text-sm text-ink-muted">{mission.passageText}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Tabs
            tabs={[
              {
                id: "roster",
                label: t("detailsRoster"),
                panel: <CustomMissionRosterTable locale={locale} rows={roster} />,
              },
              {
                id: "leaderboard",
                label: t("detailsLeaderboard"),
                panel: (
                  <CustomMissionLeaderboardTable
                    locale={locale}
                    rows={leaderboard}
                    metric={mission.leaderboardMetric}
                  />
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
