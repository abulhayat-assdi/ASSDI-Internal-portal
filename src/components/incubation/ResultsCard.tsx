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
          <Medal size={18} /> {manage ? "র‍্যাংকিং (বিক্রির আয় অনুযায়ী)" : "প্রকাশিত ফলাফল"}
        </h2>
        {manage && (
          <div className="inc-row">
            <button
              className="inc-btn primary"
              disabled={busy || !rows.length}
              onClick={() => {
                const note = window.prompt("ফলাফলের সঙ্গে নোট (ঐচ্ছিক), যেমন: সপ্তাহ ১ / চূড়ান্ত ফলাফল") ?? null;
                if (note !== null) onPublish!(note);
              }}
            >
              {published ? "নতুন করে প্রকাশ করুন" : "ফলাফল প্রকাশ করুন"}
            </button>
            {published && (
              <button
                className="inc-btn"
                disabled={busy}
                onClick={() => window.confirm("প্রকাশিত ফলাফল প্রত্যাহার করবেন?") && onWithdraw?.()}
              >
                প্রত্যাহার
              </button>
            )}
          </div>
        )}
      </div>
      <p className="inc-muted">
        {manage
          ? "চলমান হিসাব — সব posted এন্ট্রি থেকে। গ্রাহক refund বাদ দিয়ে বিক্রির আয়; অন্য টিমে হস্তান্তর বিক্রি নয়। আয় সমান হলে নিট লাভ বেশি যার, সে আগে।"
          : `${published!.snapshot.asOf} পর্যন্ত হিসাব${published!.note ? ` · ${published!.note}` : ""}`}
      </p>
      {manage && published && (
        <p className="inc-notice">
          প্রকাশিত: {new Date(published.publishedAt).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}
          {published.publishedByName ? ` — ${published.publishedByName}` : ""}
          {published.note ? ` · ${published.note}` : ""} (শিক্ষার্থী ও public লিংকে এটিই দেখা যায়)
        </p>
      )}
      <div className="inc-table-wrap">
        <table>
          <thead>
            <tr>
              <th>স্থান</th>
              <th>টিম</th>
              <th style={{ textAlign: "right" }}>বিক্রির আয়</th>
              <th style={{ textAlign: "right" }}>নিট লাভ</th>
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
