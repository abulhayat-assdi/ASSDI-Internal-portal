import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { Badge, EmptyState, PageHeader, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE, type Messages } from "@/lib/typing-game/i18n";
import { seasonPageContext } from "@/lib/typing-game/server/season-pages";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  scheduled: "primary",
  active: "success",
  processing: "warning",
  finalized: "neutral",
  cancelled: "warning",
};

const STATUS_LABEL = {
  draft: "statusDraft",
  scheduled: "statusScheduled",
  active: "statusActive",
  processing: "statusProcessing",
  finalized: "statusFinalized",
  cancelled: "statusCancelled",
} as const;

function statusLabel(status: string): keyof Messages["seasons"] | null {
  return (STATUS_LABEL as Record<string, keyof Messages["seasons"]>)[status] ?? null;
}

/** Admin season list (drafts included via RLS admin policy). */
export default async function AdminSeasonsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "seasons");
  const { store } = await seasonPageContext(locale);
  const seasons = await store.listSeasons();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("manageTitle")}
        actions={
          <Link
            href="/dashboard/typing-game/admin/seasons/new"
            className="tap-btn tap-btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{t("createTitle")}</span>
          </Link>
        }
      />
      {seasons.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" aria-hidden="true" />}
          title={t("manageTitle")}
          description={t("noSeasons")}
          action={
            <Link
              href="/dashboard/typing-game/admin/seasons/new"
              className="tap-btn tap-btn-primary"
            >
              {t("createTitle")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {seasons.map((s) => {
            const label = statusLabel(s.status);
            return (
              <Link
                key={s.id}
                href={`/dashboard/typing-game/admin/seasons/${s.id}`}
                className="tap-card tap-card-interactive flex flex-col gap-2 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="tap-card-title">{s.name}</h3>
                  <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>
                    {label ? t(label) : s.status}
                  </Badge>
                </div>
                <p className="text-xs text-ink-faint">{s.slug}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
