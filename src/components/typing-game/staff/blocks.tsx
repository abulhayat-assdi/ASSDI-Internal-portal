/**
 * Building blocks of the staff consoles (server components): hero, KPI
 * tiles, panels, and the "what is happening / what needs doing" lists.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Clock, Moon, Sparkles, type LucideIcon } from "lucide-react";
import type { InsightBatch, Insights } from "@/lib/typing-game/server/insights";
import { daysAgo } from "@/lib/typing-game/server/insights";

export type Tone = "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";
const WHITE = { color: "#fff" } as const;

export function ConsoleHero({
  tone = "admin",
  kicker,
  title,
  desc,
  children,
}: {
  tone?: "admin" | "teacher" | "super";
  kicker: string;
  title: string;
  desc?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="sc-hero p-5 sm:p-6" data-tone={tone}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.75)" }}>
            {kicker}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl" style={WHITE}>
            {title}
          </h1>
          {desc ? (
            <p className="mt-1.5 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
              {desc}
            </p>
          ) : null}
        </div>
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </section>
  );
}

export function HeroLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition hover:brightness-110"
      style={{ background: "rgba(255,255,255,0.16)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
    >
      {children}
    </Link>
  );
}

export function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "indigo",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="sc-card sc-kpi">
      <div className="flex items-center justify-between gap-2">
        <span className="sc-kpi-label">{label}</span>
        <span className={`sc-kpi-icon sc-tone-${tone}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <span className="sc-kpi-value">{value}</span>
      {hint ? <span className="sc-kpi-hint">{hint}</span> : null}
    </div>
  );
}

export function Panel({
  title,
  desc,
  action,
  children,
  className = "",
}: {
  title: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`sc-card flex flex-col gap-3 p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="sc-section-title">{title}</h2>
          {desc ? <p className="sc-section-desc">{desc}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
      {children} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-[var(--tap-border-strong)] px-4 py-6 text-center text-sm text-ink-muted">{children}</p>;
}

const REASON: Record<string, { label: string; icon: LucideIcon; cls: string }> = {
  never: { label: "এখনো শুরু করেনি", icon: Circle, cls: "tap-badge-neutral" },
  inactive: { label: "৭ দিন+ নিষ্ক্রিয়", icon: Moon, cls: "tap-badge-warning" },
  accuracy: { label: "নির্ভুলতা কম", icon: AlertTriangle, cls: "tap-badge-danger" },
};

export function AttentionList({
  data,
  studentHref,
  moreHref,
}: {
  data: Pick<Insights, "attention" | "attentionCount" | "today">;
  studentHref: (userId: string) => string;
  moreHref?: string;
}) {
  if (data.attention.length === 0) return <Empty>সবাই নিয়মিত টাইপ করছে। এখন কারো দিকে আলাদা নজর লাগবে না। 🎉</Empty>;
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col">
        {data.attention.map((a) => {
          const r = REASON[a.reason] ?? REASON.inactive;
          return (
            <li key={a.userId}>
              <Link href={studentHref(a.userId)} className="sc-row-link flex items-center gap-3 px-2 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tap-primary-50)] text-sm font-bold text-primary-600">
                  {a.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {a.batch} · রোল {a.roll} · শেষ টাইপ {daysAgo(a.lastDay, data.today)}
                    {a.reason === "accuracy" && a.accuracy != null ? ` · গড় নির্ভুলতা ${a.accuracy}%` : ""}
                  </span>
                </span>
                <span className={`tap-badge ${r.cls} hidden shrink-0 sm:inline-flex`}>{r.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {data.attentionCount > data.attention.length && moreHref ? (
        <PanelLink href={moreHref}>আরো {data.attentionCount - data.attention.length} জন</PanelLink>
      ) : null}
    </div>
  );
}

export function TopStudents({ items, studentHref }: { items: Insights["top"]; studentHref: (userId: string) => string }) {
  if (items.length === 0) return <Empty>এই সপ্তাহে এখনো কেউ টাইপ করেনি।</Empty>;
  const max = Math.max(...items.map((t) => t.minutes), 1);
  return (
    <ol className="flex flex-col gap-1">
      {items.map((t, i) => (
        <li key={t.userId}>
          <Link href={studentHref(t.userId)} className="sc-row-link flex items-center gap-3 px-2 py-2">
            <span className="w-5 text-center font-display text-sm font-extrabold text-ink-faint">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{t.name}</span>
                <span className="shrink-0 text-xs font-bold tabular-nums">{t.minutes} মি.</span>
              </span>
              <span className="sc-meter mt-1 block">
                <span style={{ width: `${(100 * t.minutes) / max}%` }} />
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {t.batch} · লেভেল {t.level}
                {t.wpm ? ` · ${t.wpm} wpm` : ""}
                {t.lessons7d ? ` · ${t.lessons7d}টা লেসন` : ""}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function BatchHealth({ batches, hrefFor }: { batches: InsightBatch[]; hrefFor?: (id: string) => string }) {
  if (batches.length === 0) return <Empty>এখনো কোনো ব্যাচ নেই।</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="tap-table w-full text-sm">
        <thead>
          <tr>
            <th scope="col" className="text-left">ব্যাচ</th>
            <th scope="col" className="text-left">টিচার</th>
            <th scope="col" className="text-right">স্টুডেন্ট</th>
            <th scope="col" className="text-left">৭ দিনে সক্রিয়</th>
            <th scope="col" className="text-right">মিনিট (৭ দিন)</th>
            <th scope="col" className="text-right">গড় লেসন</th>
            <th scope="col" className="text-right">গড় সেরা WPM</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => {
            const pct = b.members ? Math.round((100 * b.active7d) / b.members) : 0;
            const name = (
              <>
                <span className="font-semibold">{b.name}</span>
                {!b.active ? <span className="tap-badge tap-badge-neutral ml-2">বন্ধ</span> : null}
                <span className="block text-xs text-ink-faint">
                  {b.course} · কোড <code>{b.joinCode}</code>
                </span>
              </>
            );
            return (
              <tr key={b.id}>
                <th scope="row" className="text-left">
                  {hrefFor ? (
                    <Link href={hrefFor(b.id)} className="hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </th>
                <td className="text-xs">{b.teachers.length ? b.teachers.join(", ") : <span className="text-amber-600">টিচার নেই</span>}</td>
                <td className="text-right tabular-nums">{b.members}</td>
                <td>
                  <span className="flex items-center gap-2">
                    <span className="sc-meter w-20">
                      <span style={{ width: `${pct}%`, background: pct >= 60 ? "#10b981" : pct >= 30 ? "#f59e0b" : "#f43f5e" }} />
                    </span>
                    <span className="text-xs tabular-nums">
                      {b.active7d}/{b.members}
                    </span>
                  </span>
                </td>
                <td className="text-right tabular-nums">{b.minutes7d}</td>
                <td className="text-right tabular-nums">{b.lessonsAvg}</td>
                <td className="text-right tabular-nums">{b.avgWpm ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface Step {
  done: boolean;
  label: string;
  hint?: string;
  href?: string;
}

export function NextSteps({ steps }: { steps: Step[] }) {
  const left = steps.filter((s) => !s.done).length;
  return (
    <div className="flex flex-col gap-2">
      {left === 0 ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> সব ঠিকঠাক সেট করা আছে।
        </p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {steps.map((s) => {
          const Icon = s.done ? CheckCircle2 : Clock;
          const body = (
            <>
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.done ? "text-emerald-500" : "text-amber-500"}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${s.done ? "text-ink-muted" : "font-semibold"}`}>{s.label}</span>
                {s.hint && !s.done ? <span className="block text-xs text-ink-muted">{s.hint}</span> : null}
              </span>
              {s.href && !s.done ? <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" /> : null}
            </>
          );
          return (
            <li key={s.label}>
              {s.href && !s.done ? (
                <Link href={s.href} className="sc-row-link flex items-start gap-2 px-2 py-1.5">
                  {body}
                </Link>
              ) : (
                <div className="flex items-start gap-2 px-2 py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const AUDIT: Record<string, string> = {
  "batch_member.created": "স্টুডেন্ট ব্যাচে যোগ হয়েছে",
  "batch_member.updated": "স্টুডেন্টের ব্যাচ তথ্য বদলেছে",
  "batch.insert": "নতুন ব্যাচ তৈরি",
  "batch.update": "ব্যাচ আপডেট",
  "course.insert": "নতুন কোর্স তৈরি",
  "course.update": "কোর্স আপডেট",
  "course.delete": "কোর্স মুছে ফেলা",
  "batch.delete": "ব্যাচ মুছে ফেলা",
  "user_role.insert": "রোল দেওয়া হয়েছে",
  "user_role.delete": "রোল সরানো হয়েছে",
  "teacher_assignment.insert": "টিচার অ্যাসাইন",
  "teacher_assignment.delete": "টিচার অ্যাসাইনমেন্ট সরানো",
  "profile.status": "অ্যাকাউন্টের অবস্থা বদলেছে",
  "feature_flag.update": "ফিচার চালু/বন্ধ",
  "ad_settings.update": "অ্যাড সেটিংস বদলেছে",
};

export function auditLabel(action: string): string {
  return AUDIT[action] ?? action.replace(/[._]/g, " ");
}

export function AuditFeed({ entries }: { entries: { id: string | number; action: string; entity: string; createdAt: string }[] }) {
  if (entries.length === 0) return <Empty>এখনো কোনো পরিবর্তন নেই।</Empty>;
  return (
    <ul className="flex flex-col">
      {entries.map((a) => (
        <li key={a.id} className="flex items-center gap-3 border-b border-[var(--tap-border)] px-1 py-2 last:border-0">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--tap-primary-500)]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm">{auditLabel(a.action)}</span>
          <time className="shrink-0 text-xs tabular-nums text-ink-faint" dateTime={a.createdAt}>
            {a.createdAt.slice(0, 16).replace("T", " ")}
          </time>
        </li>
      ))}
    </ul>
  );
}
