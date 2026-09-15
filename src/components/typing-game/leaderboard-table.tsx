import Link from "next/link";
import { Crown } from "lucide-react";
import { Avatar, Badge, cx } from "@/components/typing-game/ui";
import type { LeaderboardRow } from "@/lib/typing-game/server/student-store";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

const WINDOWS = ["today", "week", "month", "all"] as const;

/** Server-rendered board: ranks, top-3 treatment, current-user highlight. */
export function LeaderboardTable({
  locale,
  rows,
  userId,
  window,
  batchId,
}: {
  locale: Locale;
  rows: LeaderboardRow[];
  userId: string;
  window: string;
  batchId: string;
}) {
  const t = getTranslator(locale, "leaderboard");
  const label =
    window === "today"
      ? t("windowToday")
      : window === "week"
        ? t("windowWeek")
        : window === "month"
          ? t("windowMonth")
          : t("windowAll");
  return (
    <div className="flex flex-col gap-4">
      <div className="tap-tablist" role="group" aria-label={t("title")}>
        {WINDOWS.map((w) => {
          const active = w === window;
          const text =
            w === "today"
              ? t("windowToday")
              : w === "week"
                ? t("windowWeek")
                : w === "month"
                  ? t("windowMonth")
                  : t("windowAll");
          return (
            <Link
              key={w}
              href={`/student-dashboard/typing-game/leaderboard?window=${w}&batch=${encodeURIComponent(batchId)}`}
              aria-current={active ? "page" : undefined}
              className={cx("tap-tab", active && "tap-tab-active")}
            >
              {text}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {t("noRuns")} ({label})
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tap-table">
            <caption className="tap-sr-only">
              {t("title")} — {label}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("rank")}</th>
                <th scope="col">{t("player")}</th>
                <th scope="col">{t("level")}</th>
                <th scope="col">{t("xp")}</th>
                <th scope="col">{t("wpm")}</th>
                <th scope="col">{t("accuracy")}</th>
                <th scope="col">{t("streak")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const me = r.userId === userId;
                return (
                  <tr
                    key={r.userId}
                    className={
                      me ? "tap-row-me" : r.rank <= 3 ? "tap-row-top" : undefined
                    }
                  >
                    <td>
                      <span className="inline-flex items-center gap-1">
                        {r.rank === 1 ? (
                          <Crown
                            className="h-4 w-4"
                            style={{ color: "var(--tap-warning-500)" }}
                            aria-hidden="true"
                          />
                        ) : r.rank <= 3 ? (
                          <span aria-hidden="true">{r.rank === 2 ? "🥈" : "🥉"}</span>
                        ) : null}
                        {r.rank}
                      </span>
                    </td>
                    <th scope="row">
                      <div className="flex items-center gap-2">
                        <Avatar name={r.fullName} size="sm" />
                        <span>
                          {r.fullName}{" "}
                          <span className="text-ink-faint">({r.rollNumber})</span>
                        </span>
                        {me ? <Badge tone="primary">{t("you")}</Badge> : null}
                      </div>
                    </th>
                    <td>{r.level}</td>
                    <td>{r.xpWindow}</td>
                    <td>{Math.round(r.avgWpm)}</td>
                    <td>{Math.round(r.avgAccuracy)}%</td>
                    <td>{r.streak}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
