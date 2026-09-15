import Link from "next/link";
import { Trophy } from "lucide-react";
import { Badge, Card, CardContent, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import type { TournamentSummary } from "@/lib/typing-game/server/tournament-store";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  registration_open: "primary",
  registration_closed: "warning",
  seeded: "warning",
  live: "danger",
  processing: "warning",
  finalized: "success",
  cancelled: "neutral",
};

/** Tournament list card: theme, format, status, contestant type. */
export function TournamentCard({
  locale,
  tournament,
  href,
}: {
  locale: Locale;
  tournament: TournamentSummary;
  href: string;
}) {
  const t = getTranslator(locale, "tournaments");
  return (
    <Card interactive data-visual="grand-arena">
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="tap-shop-glyph" aria-hidden="true">
              <Trophy className="h-5 w-5 text-white" />
            </span>
            <div>
              <Link href={href} className="text-base font-bold hover:underline">
                {tournament.name}
              </Link>
              <p className="text-sm text-ink-muted">
                {tournament.theme.length > 0 ? `${tournament.theme} · ` : ""}
                {tournament.participantType === "clan" ? t("typeClan") : t("typeStudent")}
              </p>
            </div>
          </div>
          <Badge tone={STATUS_TONE[tournament.status] ?? "neutral"}>
            {tournament.status === "live" ? (
              <span className="tap-live-dot" aria-hidden="true" />
            ) : null}
            {tournament.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
