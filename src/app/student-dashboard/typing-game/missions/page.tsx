import Link from "next/link";
import { CheckCircle2, ScrollText, Sparkles } from "lucide-react";
import { Badge, Card, CardContent, EmptyState, PageHeader, SectionHeader } from "@/components/typing-game/ui";
import { DEFAULT_LOCALE, getTranslator } from "@/lib/typing-game/i18n";
import { customMissionPageContext } from "@/lib/typing-game/server/custom-mission-pages";
import { missionRuleSummary } from "@/lib/typing-game/custom-mission-ui";
import type { CustomMission } from "@/lib/typing-game/server/custom-mission-store";

/**
 * Student mission hub: teacher-authored custom missions assigned to my
 * batch(es), grouped by whether I've completed them yet. Replaces the old
 * daily/weekly/event auto-mission hub entirely.
 */
export default async function MissionsPage() {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  const { session, store } = await customMissionPageContext(locale);

  const missions = await store.listAssigned(session.userId);
  const withCompletion = await Promise.all(
    missions.map(async (mission) => ({
      mission,
      completedAt: (await store.getMyCompletion(mission.id, session.userId))?.completedAt ?? null,
    })),
  );

  const notStarted = withCompletion.filter((m) => m.completedAt === null);
  const completed = withCompletion.filter((m) => m.completedAt !== null);

  const groups = [
    { key: "notStarted", title: t("groupNotStarted"), items: notStarted },
    { key: "completed", title: t("groupCompleted"), items: completed },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("listTitle")} description={t("listSubtitle")} />

      {missions.length === 0 ? (
        <EmptyState
          title={t("listTitle")}
          description={t("noMissions")}
          icon={<ScrollText className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        groups.map((group) =>
          group.items.length === 0 ? null : (
            <section key={group.key} aria-label={group.title}>
              <SectionHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    {group.key === "completed" ? (
                      <CheckCircle2
                        className="h-4 w-4"
                        style={{ color: "var(--tap-success-500)" }}
                        aria-hidden="true"
                      />
                    ) : (
                      <Sparkles
                        className="h-4 w-4"
                        style={{ color: "var(--tap-accent-from)" }}
                        aria-hidden="true"
                      />
                    )}
                    {group.title}
                  </span>
                }
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {group.items.map(({ mission, completedAt }) => (
                  <MissionListCard
                    key={mission.id}
                    mission={mission}
                    completed={completedAt !== null}
                    ruleLabel={missionRuleSummary(t, mission)}
                    rewardLabel={t("rewardSummary", {
                      xp: mission.rewardXp,
                      coins: mission.rewardCoins,
                    })}
                    completeLabel={t("statusCompleted")}
                  />
                ))}
              </div>
            </section>
          ),
        )
      )}
    </div>
  );
}

function MissionListCard({
  mission,
  completed,
  ruleLabel,
  rewardLabel,
  completeLabel,
}: {
  mission: CustomMission;
  completed: boolean;
  ruleLabel: string;
  rewardLabel: string;
  completeLabel: string;
}) {
  return (
    <Card interactive>
      <CardContent>
        <Link
          href={`/student-dashboard/typing-game/missions/${mission.id}`}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold">{mission.title}</h3>
            {completed ? <Badge tone="success">{completeLabel}</Badge> : null}
          </div>
          {mission.description ? (
            <p className="text-sm text-ink-muted">{mission.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <Badge tone="neutral">{ruleLabel}</Badge>
            <span>{rewardLabel}</span>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
