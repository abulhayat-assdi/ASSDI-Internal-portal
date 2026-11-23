/**
 * Student list with learning progress and simple filters (server component;
 * the filters are a plain GET form so links to a filtered view work).
 */
import Link from "next/link";
import { Search } from "lucide-react";
import type { StaffStudentRow } from "@/lib/typing-game/server/insights";
import { daysAgo } from "@/lib/typing-game/server/insights";
import { Empty } from "./blocks";

export type StudentFilter = "all" | "today" | "inactive" | "never" | "attention";

export const STUDENT_FILTERS: { key: StudentFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Active today" },
  { key: "attention", label: "Needs attention" },
  { key: "inactive", label: "Inactive 7d+" },
  { key: "never", label: "Not started" },
];

export function applyStudentFilter(rows: StaffStudentRow[], filter: StudentFilter, today: string): StaffStudentRow[] {
  const age = (d: string | null) => (d ? Math.round((Date.parse(today) - Date.parse(d)) / 86400000) : Infinity);
  switch (filter) {
    case "today":
      return rows.filter((r) => age(r.lastDay) <= 0);
    case "inactive":
      return rows.filter((r) => r.lastDay !== null && age(r.lastDay) >= 7);
    case "never":
      return rows.filter((r) => r.lastDay === null && r.lessons === 0);
    case "attention":
      return rows.filter((r) => age(r.lastDay) >= 7);
    default:
      return rows;
  }
}

export function StudentFilters({
  action,
  q,
  batch,
  filter,
  batches,
  counts,
}: {
  action: string;
  q: string;
  batch: string;
  filter: StudentFilter;
  batches?: { id: string; name: string }[];
  counts: Record<StudentFilter, number>;
}) {
  const href = (f: StudentFilter) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (batch) p.set("batch", batch);
    if (f !== "all") p.set("filter", f);
    const s = p.toString();
    return s ? `${action}?${s}` : action;
  };
  return (
    <div className="flex flex-col gap-3">
      <form method="get" action={action} className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, email or roll"
            className="w-full rounded-xl border border-[var(--tap-border-strong)] bg-[var(--tap-surface-solid)] py-2 pl-9 pr-3 text-sm"
          />
        </label>
        {batches && batches.length > 1 ? (
          <select
            name="batch"
            defaultValue={batch}
            aria-label="Batch"
            className="rounded-xl border border-[var(--tap-border-strong)] bg-[var(--tap-surface-solid)] px-3 py-2 text-sm"
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : null}
        {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
        <button type="submit" className="tap-btn tap-btn-primary tap-btn-md">
          Search
        </button>
      </form>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Student filter">
        {STUDENT_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href(f.key)}
            role="tab"
            aria-selected={filter === f.key}
            className={
              "rounded-full border px-3 py-1 text-xs font-semibold transition " +
              (filter === f.key
                ? "border-transparent bg-[var(--tap-primary-600)] text-white"
                : "border-[var(--tap-border-strong)] text-ink-muted hover:text-ink")
            }
          >
            {f.label} <span className="tabular-nums opacity-80">{counts[f.key]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function StudentTable({
  rows,
  today,
  hrefFor,
  showBatch = true,
}: {
  rows: StaffStudentRow[];
  today: string;
  hrefFor: (userId: string) => string;
  showBatch?: boolean;
}) {
  if (rows.length === 0) return <Empty>No students match this filter.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="tap-table w-full text-sm">
        <thead>
          <tr>
            <th scope="col" className="text-left">Student</th>
            {showBatch ? <th scope="col" className="text-left">Batch · Roll</th> : <th scope="col" className="text-left">Roll</th>}
            <th scope="col" className="text-right">Level</th>
            <th scope="col" className="text-right">Lessons</th>
            <th scope="col" className="text-right">Best WPM</th>
            <th scope="col" className="text-right">Minutes (7d)</th>
            <th scope="col" className="text-left">Last typed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const last = daysAgo(r.lastDay, today);
            const stale = !r.lastDay || Date.parse(today) - Date.parse(r.lastDay) >= 7 * 86400000;
            return (
              <tr key={r.userId}>
                <th scope="row" className="text-left">
                  <Link href={hrefFor(r.userId)} className="font-semibold hover:underline">
                    {r.name}
                  </Link>
                  {r.status !== "active" ? <span className="tap-badge tap-badge-danger ml-2">{r.status}</span> : null}
                  <span className="block text-xs font-normal text-ink-faint">{r.email}</span>
                </th>
                <td>{showBatch ? `${r.batch} · ${r.roll}` : r.roll}</td>
                <td className="text-right tabular-nums">{r.level}</td>
                <td className="text-right tabular-nums">{r.lessons}</td>
                <td className="text-right tabular-nums">{r.bestWpm ?? "—"}</td>
                <td className="text-right tabular-nums">{r.minutes7d}</td>
                <td>
                  <span className={stale ? "font-semibold text-amber-600" : ""}>{last}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
