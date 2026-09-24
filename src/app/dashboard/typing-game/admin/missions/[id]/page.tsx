import { notFound } from "next/navigation";
import { Badge, Card, CardContent, PageHeader, SectionHeader, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE, type Messages } from "@/lib/typing-game/i18n";
import { missionPageContext } from "@/lib/typing-game/server/mission-pages";
import { MissionAdminActions } from "@/components/typing-game/mission-admin-actions";

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

/** Admin global mission management: activation + objective authoring. */
export default async function AdminMissionManagePage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  const { store } = await missionPageContext(locale);
  const missions = await store.listMissions();
  const def = missions.find((m) => m.id === params.id);
  if (!def) notFound();
  const label = statusLabel(def.status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={def.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{`${def.slug} · v${String(def.version)}`}</span>
            <Badge tone={STATUS_TONE[def.status] ?? "neutral"}>
              {label ? t(label) : def.status}
            </Badge>
          </span>
        }
      />
      <Card>
        <CardContent>
          <SectionHeader title={t("fieldCategory")} />
          <p className="text-sm text-ink-muted">{def.category}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <MissionAdminActions
            locale={locale}
            missionId={def.id}
            status={def.status}
          />
        </CardContent>
      </Card>
    </div>
  );
}
