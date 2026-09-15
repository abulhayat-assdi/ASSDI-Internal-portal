import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import type { WarBoardRow } from "@/lib/typing-game/server/war-store";

/** War scoreboard: clan totals first (as an opposing score bar), then rows. */
export function WarBoard({
  locale,
  rows,
}: {
  locale: Locale;
  rows: WarBoardRow[];
}) {
  const t = getTranslator(locale, "wars");
  const totals = rows.filter((r) => r.scope !== "member");
  const members = rows.filter((r) => r.scope === "member");
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">{t("emptySection")}</p>;
  }
  const mine = totals.find((r) => r.isMe) ?? totals[0] ?? null;
  const theirs = totals.find((r) => r !== mine) ?? null;
  const mineScore = mine?.score ?? 0;
  const theirsScore = theirs?.score ?? 0;
  const total = Math.max(mineScore + theirsScore, 1);
  return (
    <div className="flex flex-col gap-4">
      {mine && theirs ? (
        <div aria-hidden="true">
          <div className="tap-war-vs">
            <span className="tap-war-side">
              <span className="tap-war-side-name">{mine.displayName}</span>
              <br />
              <span className="tap-war-side-score">{mineScore}</span>
            </span>
            <span className="tap-war-vs-badge">{t("vsBadge")}</span>
            <span className="tap-war-side tap-war-side-right">
              <span className="tap-war-side-name">{theirs.displayName}</span>
              <br />
              <span className="tap-war-side-score">{theirsScore}</span>
            </span>
          </div>
          <div className="tap-war-bar mt-2">
            <span
              className="tap-war-bar-a"
              style={{ width: `${String((mineScore / total) * 100)}%` }}
            />
            <span
              className="tap-war-bar-b"
              style={{ width: `${String((theirsScore / total) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="tap-table" aria-label={t("boardClans")}>
          <thead>
            <tr>
              <th scope="col">{t("colClan")}</th>
              <th scope="col">{t("colScore")}</th>
              <th scope="col">{t("colAttempts")}</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((r) => (
              <tr key={`${r.scope}-${r.clanId}`} className={r.isMe ? "tap-row-mine" : undefined}>
                <td>{r.displayName}</td>
                <td>{r.score}</td>
                <td>{r.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {members.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="tap-table" aria-label={t("boardMembers")}>
            <thead>
              <tr>
                <th scope="col">{t("colPlayer")}</th>
                <th scope="col">{t("colScore")}</th>
                <th scope="col">{t("colAttempts")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((r) => (
                <tr
                  key={`${r.clanId}-${r.displayName}`}
                  className={r.isMe ? "tap-row-mine" : undefined}
                >
                  <td>{r.displayName}</td>
                  <td>{r.score}</td>
                  <td>{r.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
