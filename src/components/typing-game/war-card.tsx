import Link from "next/link";
import { Badge, Card, CardContent, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import type { WarSummary } from "@/lib/typing-game/server/war-store";

type StatusKey =
  | "statusDraft"
  | "statusChallengeSent"
  | "statusPendingResponse"
  | "statusAccepted"
  | "statusDeclined"
  | "statusPreparation"
  | "statusLive"
  | "statusProcessing"
  | "statusFinalized"
  | "statusCancelled"
  | "statusExpired";

function statusKey(status: string): StatusKey {
  switch (status) {
    case "draft":
      return "statusDraft";
    case "challenge_sent":
      return "statusChallengeSent";
    case "pending_response":
      return "statusPendingResponse";
    case "accepted":
      return "statusAccepted";
    case "declined":
      return "statusDeclined";
    case "preparation":
      return "statusPreparation";
    case "live":
      return "statusLive";
    case "processing":
      return "statusProcessing";
    case "finalized":
      return "statusFinalized";
    case "cancelled":
      return "statusCancelled";
    default:
      return "statusExpired";
  }
}

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  challenge_sent: "primary",
  pending_response: "warning",
  accepted: "primary",
  declined: "danger",
  preparation: "warning",
  live: "danger",
  processing: "warning",
  finalized: "success",
  cancelled: "neutral",
  expired: "neutral",
};

/** War card with YOUR CLAN vs OPPONENT battle framing. */
export function WarCard({
  locale,
  war,
  href,
}: {
  locale: Locale;
  war: WarSummary;
  href: string;
}) {
  const t = getTranslator(locale, "wars");
  const mineFirst = war.myClanId === war.challengerClanId;
  const mine = mineFirst ? war.challengerName : war.defenderName;
  const theirs = mineFirst ? war.defenderName : war.challengerName;
  const isLive = war.status === "live";
  return (
    <Card interactive>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="tap-war-vs flex-1 hover:opacity-90">
            <span className="tap-war-side">
              <span className="tap-war-side-name">{mine || "—"}</span>
            </span>
            <span className="tap-war-vs-badge">{t("vsBadge")}</span>
            <span className="tap-war-side tap-war-side-right">
              <span className="tap-war-side-name">{theirs || "—"}</span>
            </span>
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone={STATUS_TONE[war.status] ?? "neutral"}>
            {isLive ? <span className="tap-live-dot" aria-hidden="true" /> : null}
            {t(statusKey(war.status))}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
