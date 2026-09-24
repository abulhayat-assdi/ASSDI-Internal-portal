import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Badge, EmptyState, PageHeader, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE, type Messages } from "@/lib/typing-game/i18n";
import { missionPageContext } from "@/lib/typing-game/server/mission-pages";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  active: "success",
  inactive: "warning",
};

const STATUS_LABEL = {
  draft: "missionStatusDraft",
  active: "missionStatusActive",
  inactive: "missionStatusInactive",
} as const;

function statusLabel(status: string): keyof Messages["missions"] | null {
  return (
    (STATUS_LABEL as Record<string, keyof Messages["missions"]>)[status] ?? null
  );
}

/** Admin global mission definitions (drafts included via RLS admin policy). */
export default async function AdminMissionsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  const { store } = await missionPageContext(locale);
  const missions = await store.listMissions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("globalHubTitle")} description={t("globalHubSubtitle")} />
      {missions.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-8 w-8" aria-hidden="true" />}
          title={t("globalHubTitle")}
          description={t("noMissions")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {missions.map((m) => {
            const label = statusLabel(m.status);
            return (
              <Link
                key={m.id}
                href={`/dashboard/typing-game/admin/missions/${m.id}`}
                className="tap-card tap-card-interactive flex flex-col gap-2 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="tap-card-title">{m.title}</h3>
                  <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>
                    {label ? t(label) : m.status}
                  </Badge>
                </div>
                <p className="text-xs text-ink-faint">{m.slug}</p>
                <p className="text-sm text-ink-muted">
                  {t("colCategory")}: {m.category} · {t("colVersion")}{" "}
                  {String(m.version)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
