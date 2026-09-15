import Link from "next/link";
import { Gift, Zap } from "lucide-react";
import { Badge, Card, CardContent, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import {
  formatDateTime,
  rewardSummary,
  statusKey,
  type CompetitionSection,
} from "@/lib/typing-game/competitions";
import type { CompetitionCard as CardData } from "@/lib/typing-game/server/competition-store";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  scheduled: "neutral",
  registration_open: "primary",
  registration_closed: "warning",
  live: "danger",
  ended: "warning",
  processing: "warning",
  finalized: "success",
  cancelled: "neutral",
};

/** Competition summary card used on hub + staff lists. */
export function CompetitionCard({
  locale,
  competition,
  href,
  section,
}: {
  locale: Locale;
  competition: CardData;
  href: string;
  section: CompetitionSection;
}) {
  const t = getTranslator(locale, "competitions");
  const rewards = rewardSummary(
    competition.rewardPreview,
    t("fieldWinnerXp"),
    t("fieldParticipationXp"),
  );
  return (
    <Card interactive data-visual={section === "live" ? "arena" : undefined}>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold">
            <Link href={href}>{competition.title}</Link>
          </h3>
          <Badge tone={STATUS_TONE[competition.status] ?? "neutral"}>
            {competition.status === "live" ? (
              <span className="tap-live-dot" aria-hidden="true" />
            ) : null}
            {t(statusKey(competition.status))}
          </Badge>
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          {competition.type} ·{" "}
          {t("cardGame", { game: competition.gameSlugs[0] ?? "—" })}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {section === "completed"
            ? t("cardEnds", {
                date: formatDateTime(competition.endsAt, locale),
              })
            : t("cardStarts", {
                date: formatDateTime(competition.startsAt, locale),
              })}
          {" · "}
          {t("cardAttempts", { count: competition.attemptLimit })}
        </p>
        {rewards ? (
          <p className="mt-1 flex items-center gap-1 text-sm">
            <Gift className="h-3.5 w-3.5" aria-hidden="true" />
            {rewards}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
