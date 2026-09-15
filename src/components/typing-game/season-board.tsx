import { Badge, type BadgeTone } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import type { SeasonBoardRow } from "@/lib/typing-game/server/season-store";

export type SeasonStatusKey =
  | "statusDraft"
  | "statusScheduled"
  | "statusActive"
  | "statusProcessing"
  | "statusFinalized"
  | "statusCancelled";

/** Translation key for a season's lifecycle status pill. */
export function seasonStatusKey(status: string): SeasonStatusKey {
  switch (status) {
    case "draft":
      return "statusDraft";
    case "scheduled":
      return "statusScheduled";
    case "active":
      return "statusActive";
    case "processing":
      return "statusProcessing";
    case "finalized":
      return "statusFinalized";
    case "cancelled":
      return "statusCancelled";
    default:
      return "statusDraft";
  }
}

/** Badge tone for a season's lifecycle status pill. */
export function seasonStatusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
      return "success";
    case "processing":
      return "warning";
    case "scheduled":
      return "primary";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

/** Badge tone for a competitive-ladder tier name (free-form, admin-defined). */
function tierTone(tier: string | null): BadgeTone {
  if (!tier) return "neutral";
  const v = tier.toLowerCase();
  if (v.includes("legend") || v.includes("diamond") || v.includes("master")) return "legendary";
  if (v.includes("gold")) return "warning";
  if (v.includes("platinum") || v.includes("emerald")) return "success";
  if (v.includes("silver")) return "neutral";
  return "primary";
}

/** Season leaderboard table (students or clans, server-ranked). */
export function SeasonBoard({
  locale,
  rows,
  clan,
  meId,
}: {
  locale: Locale;
  rows: SeasonBoardRow[];
  clan: boolean;
  meId?: string;
}) {
  const t = getTranslator(locale, "seasons");
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">{t("emptyBoard")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="tap-table">
        <thead>
          <tr>
            <th scope="col">{t("colRank")}</th>
            <th scope="col">{clan ? t("colClan") : t("colPlayer")}</th>
            <th scope="col">{t("colPoints")}</th>
            <th scope="col">{t("colTier")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mine = meId != null && r.participantId === meId;
            return (
              <tr
                key={r.participantId}
                className={mine ? "tap-row-me" : r.rank <= 3 ? "tap-row-top" : undefined}
              >
                <td>
                  {r.rank <= 3 ? (
                    <span aria-hidden="true">
                      {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}
                    </span>
                  ) : null}{" "}
                  {r.rank}
                </td>
                <th scope="row">
                  {r.displayName}
                  {mine ? (
                    <span className="tap-badge tap-badge-primary ml-2">{t("you")}</span>
                  ) : null}
                </th>
                <td className="font-semibold">{r.points}</td>
                <td>{r.tier ? <Badge tone={tierTone(r.tier)}>{r.tier}</Badge> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
