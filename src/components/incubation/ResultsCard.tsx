"use client";
import { Medal } from "lucide-react";
import type { RankedTeam } from "@/lib/incubation/results";

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format((n || 0) / 100);

type Published = {
  snapshot: { asOf: string; ranking: RankedTeam[] };
  note?: string;
  publishedAt: string;
  publishedByName?: string;
} | null;

/**
 * Revenue ranking. Staff see the live standings beside the published
 * (frozen) result and can publish or withdraw; everyone else sees only
 * what has been published.
 */
export default function ResultsCard({
  published,
  live,
  highlightTeamId,
  busy,
  onPublish,
  onWithdraw,
}: {
  published: Published;
  live?: RankedTeam[];
  highlightTeamId?: string;
  busy?: boolean;
  onPublish?: (note: string) => void;
  onWithdraw?: () => void;
}) {
  const manage = !!onPublish;
  const rows = manage ? live ?? [] : published?.snapshot.ranking ?? [];
  if (!manage && !published) return null;
  return (
    <section className="inc-card inc-results">
      <div className="inc-row inc-between">
        <h2>
          <Medal size={18} /> {manage ? "Ranking (by revenue)" : "Published results"}
        </h2>
        {manage && (
          <div className="inc-row">
            <button
              className="inc-btn primary"
              disabled={busy || !rows.length}
              onClick={() => {
                const note = window.prompt("Optional note to show with the results, e.g. Week 1 / Final results") ?? null;
                if (note !== null) onPublish!(note);
              }}
            >
              {published ? "Publish again" : "Publish results"}
            </button>
            {published && (
              <button
                className="inc-btn"
                disabled={busy}
                onClick={() => window.confirm("Withdraw the published results?") && onWithdraw?.()}
              >
                Withdraw results
              </button>
            )}
          </div>
        )}
      </div>
      <p className="inc-muted">
        {manage
          ? "Live standings from all posted entries. Revenue is sales minus customer refunds; transfers to other teams are not sales. If revenue is equal, higher net profit ranks first."
          : `As of ${published!.snapshot.asOf}${published!.note ? ` · ${published!.note}` : ""}`}
      </p>
      {manage && published && (
        <p className="inc-notice">
          Published: {new Date(published.publishedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}
          {published.publishedByName ? ` — ${published.publishedByName}` : ""}
          {published.note ? ` · ${published.note}` : ""} (this is what students and the public link see)
        </p>
      )}
      <div className="inc-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th style={{ textAlign: "right" }}>Revenue</th>
              <th style={{ textAlign: "right" }}>Net profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId ?? r.teamName} className={r.teamId && r.teamId === highlightTeamId ? "inc-own-row" : ""}>
                <td>
                  <b>{r.rank}</b>
                  {r.rank <= 3 ? [" 🥇", " 🥈", " 🥉"][r.rank - 1] : ""}
                </td>
                <td>{r.teamName}</td>
                <td style={{ textAlign: "right" }}>{money(r.revenue)}</td>
                <td style={{ textAlign: "right" }}>{money(r.netProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
