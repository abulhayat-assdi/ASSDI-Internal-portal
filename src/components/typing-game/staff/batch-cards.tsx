import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { InsightBatch } from "@/lib/typing-game/server/insights";
import { Empty } from "./blocks";

/** A card per batch: who is active this week, minutes, lessons, speed. */
export function BatchCards({ batches, hrefFor }: { batches: InsightBatch[]; hrefFor: (id: string) => string }) {
  if (batches.length === 0) return <Empty>আপনাকে এখনো কোনো ব্যাচে অ্যাসাইন করা হয়নি। অ্যাডমিনকে বলুন Teachers পেজ থেকে অ্যাসাইন করতে।</Empty>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {batches.map((b) => {
        const pct = b.members ? Math.round((100 * b.active7d) / b.members) : 0;
        return (
          <Link key={b.id} href={hrefFor(b.id)} className="sc-card sc-row-link flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-extrabold">{b.name}</p>
                <p className="truncate text-xs text-ink-muted">
                  {b.course} · Code <code>{b.joinCode}</code>
                </p>
              </div>
              {!b.active ? <span className="tap-badge tap-badge-neutral">Inactive</span> : <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />}
            </div>
            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold">Active (7 days)</span>
                <span className="tabular-nums">
                  {b.active7d}/{b.members}
                </span>
              </div>
              <span className="sc-meter mt-1 block">
                <span style={{ width: `${pct}%`, background: pct >= 60 ? "#10b981" : pct >= 30 ? "#f59e0b" : "#f43f5e" }} />
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                { k: "Minutes (7d)", v: b.minutes7d },
                { k: "Avg lessons", v: b.lessonsAvg },
                { k: "Avg best WPM", v: b.avgWpm ?? "—" },
              ].map((x) => (
                <div key={x.k} className="rounded-xl bg-[var(--tap-primary-50)] px-2 py-2">
                  <dt className="text-[11px] text-ink-muted">{x.k}</dt>
                  <dd className="font-display text-lg font-extrabold tabular-nums">{x.v}</dd>
                </div>
              ))}
            </dl>
          </Link>
        );
      })}
    </div>
  );
}
