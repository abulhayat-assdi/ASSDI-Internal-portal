import Link from "next/link";
import { Plus, Skull } from "lucide-react";
import { Badge, EmptyState, PageHeader, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE, type Messages } from "@/lib/typing-game/i18n";
import { bossPageContext } from "@/lib/typing-game/server/boss-pages";

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
  scheduled: "primary",
  defeated: "neutral",
  finalized: "neutral",
  expired: "warning",
};

const STATUS_LABEL = {
  scheduled: "statusScheduled",
  active: "statusActive",
  defeated: "statusDefeated",
  expired: "statusExpired",
  finalized: "statusFinalized",
} as const;

function statusLabel(status: string): keyof Messages["bosses"] | null {
  return (STATUS_LABEL as Record<string, keyof Messages["bosses"]>)[status] ?? null;
}

/** Admin boss definitions (drafts included via RLS admin policy). */
export default async function AdminBossesPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "bosses");
  const { store } = await bossPageContext(locale);
  const bosses = await store.listBosses();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("manageTitle")}
        actions={
          <Link
            href="/dashboard/typing-game/admin/bosses/new"
            className="tap-btn tap-btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{t("createTitle")}</span>
          </Link>
        }
      />
      {bosses.length === 0 ? (
        <EmptyState
          icon={<Skull className="h-8 w-8" aria-hidden="true" />}
          title={t("manageTitle")}
          description={t("noBosses")}
          action={
            <Link
              href="/dashboard/typing-game/admin/bosses/new"
              className="tap-btn tap-btn-primary"
            >
              {t("createTitle")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {bosses.map((b) => {
            const label = statusLabel(b.status);
            return (
              <Link
                key={b.id}
                href={`/dashboard/typing-game/admin/bosses/${b.id}`}
                className="tap-card tap-card-interactive flex flex-col gap-2 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="tap-card-title">{b.name}</h3>
                  <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>
                    {label ? t(label) : b.status}
                  </Badge>
                </div>
                <p className="text-xs text-ink-faint">{b.slug}</p>
                <p className="text-sm text-ink-muted">
                  {b.difficulty} · {b.maxHp} HP
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
