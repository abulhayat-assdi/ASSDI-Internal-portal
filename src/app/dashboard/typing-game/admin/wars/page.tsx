import Link from "next/link";
import { Swords } from "lucide-react";
import { Badge, EmptyState, PageHeader, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE, type Messages } from "@/lib/typing-game/i18n";
import { warPageContext } from "@/lib/typing-game/server/war-pages";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  live: "success",
  finalized: "primary",
  cancelled: "warning",
  expired: "warning",
  declined: "warning",
};

const STATUS_LABEL = {
  draft: "statusDraft",
  challenge_sent: "statusChallengeSent",
  pending_response: "statusPendingResponse",
  accepted: "statusAccepted",
  declined: "statusDeclined",
  preparation: "statusPreparation",
  live: "statusLive",
  processing: "statusProcessing",
  finalized: "statusFinalized",
  cancelled: "statusCancelled",
  expired: "statusExpired",
} as const;

function statusLabel(status: string): keyof Messages["wars"] | null {
  return (STATUS_LABEL as Record<string, keyof Messages["wars"]>)[status] ?? null;
}

/** Admin war list (RLS-scoped to managed organizations). */
export default async function AdminWarsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "wars");
  const { store } = await warPageContext(locale);
  const wars = await store.listWars();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("manageTitle")} />
      {wars.length === 0 ? (
        <EmptyState
          icon={<Swords className="h-8 w-8" aria-hidden="true" />}
          title={t("manageTitle")}
          description={t("noWars")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {wars.map((w) => {
            const label = statusLabel(w.status);
            return (
              <Link
                key={w.id}
                href={`/dashboard/typing-game/admin/wars/${w.id}`}
                className="tap-card tap-card-interactive flex flex-col gap-2 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="tap-card-title">
                    {t("versus", { a: w.challengerName, b: w.defenderName })}
                  </h3>
                  <Badge tone={STATUS_TONE[w.status] ?? "neutral"}>
                    {label ? t(label) : w.status}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
