import Link from "next/link";
import { Plus, ScrollText } from "lucide-react";
import { Badge, EmptyState, PageHeader, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { createSupabaseCustomMissionStore } from "@/lib/typing-game/server/custom-mission-store";
import { missionStatusKey } from "@/lib/typing-game/custom-missions";
import { formatDateTime } from "@/lib/typing-game/competitions";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  active: "success",
  archived: "warning",
};

/** Teacher's custom missions: list + entry to create a new one. */
export default async function TeacherMissionsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) {
    return <PageHeader title={t("teacherHubTitle")} />;
  }
  const store = createSupabaseCustomMissionStore(client);
  const missions = await store.listMine(session.userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("teacherHubTitle")}
        description={t("teacherHubSubtitle")}
        actions={
          <Link
            href="/dashboard/typing-game/teacher/missions/new"
            className="tap-btn tap-btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{t("createTitle")}</span>
          </Link>
        }
      />

      {missions.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-8 w-8" aria-hidden="true" />}
          title={t("noMissions")}
          description={t("teacherHubSubtitle")}
          action={
            <Link
              href="/dashboard/typing-game/teacher/missions/new"
              className="tap-btn tap-btn-primary"
            >
              {t("createTitle")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {missions.map((m) => (
            <Link
              key={m.id}
              href={`/dashboard/typing-game/teacher/missions/${m.id}`}
              className="tap-card tap-card-interactive flex flex-col gap-2 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="tap-card-title">{m.title}</h3>
                <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>
                  {t(missionStatusKey(m.status))}
                </Badge>
              </div>
              <p className="line-clamp-2 text-sm text-ink-muted">
                {m.description || m.passageText}
              </p>
              <p className="text-xs text-ink-faint">
                {t("colCreatedAt")}: {formatDateTime(m.createdAt, locale)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
