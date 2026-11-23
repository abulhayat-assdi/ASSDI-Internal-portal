import Link from "next/link";
import { BookOpenCheck, Clock3, Flame, Gauge, Layers, Plus, Search, Users } from "lucide-react";
import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { getAdminOverview } from "@/lib/typing-game/server/staff-data";
import { loadInsights } from "@/lib/typing-game/server/insights";
import { createAdsStore } from "@/lib/typing-game/server/ads-store";
import { FEATURES } from "@/lib/typing-game/features";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { ActivityChart } from "@/components/typing-game/staff/activity-chart";
import {
  AttentionList,
  AuditFeed,
  BatchHealth,
  ConsoleHero,
  HeroLink,
  Kpi,
  NextSteps,
  Panel,
  PanelLink,
  TopStudents,
} from "@/components/typing-game/staff/blocks";

export const dynamic = "force-dynamic";

const BASE = "/dashboard/typing-game/admin";

export default async function AdminDashboardPage() {
  const locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let overview;
  let orgIds: string[] | null;
  try {
    ({ orgIds } = await requireAdmin(client));
    overview = await getAdminOverview(orgIds, createSupabaseStaffStore(client));
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }
  const [ins, ads] = await Promise.all([loadInsights(client), createAdsStore(client).settings()]);
  const t = ins.totals;
  const flags = new Map(overview.flags.map((f) => [f.key, f.enabled]));
  const orgName = overview.orgs.length === 1 ? overview.orgs[0].name : orgIds === null ? "All courses" : "Your course";
  const noTeacher = ins.batches.filter((b) => b.active && b.teachers.length === 0).length;
  const pct = (n: number) => (t.students ? `${Math.round((100 * n) / t.students)}%` : "—");
  const student = (id: string) => `${BASE}/students/${id}`;

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        kicker={orgName}
        title="Admin Dashboard"
        desc={
          t.students === 0
            ? "এখনো কোনো স্টুডেন্ট নেই। ব্যাচ তৈরি করে স্টুডেন্টদের জয়েন কোড দিন।"
            : `আজ ${t.activeToday} জন স্টুডেন্ট ${t.minutesToday} মিনিট টাইপ করেছে। গত ৭ দিনে সক্রিয় ${t.active7d}/${t.students} জন।`
        }
      >
        <HeroLink href={`${BASE}/batches`}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New batch
        </HeroLink>
        <HeroLink href={`${BASE}/students`}>
          <Search className="h-4 w-4" aria-hidden="true" /> Find student
        </HeroLink>
      </ConsoleHero>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Users} label="Students" value={t.students} hint={`In ${t.activeBatches} active batches`} tone="indigo" />
        <Kpi icon={Flame} label="Active today" value={t.activeToday} hint={`${pct(t.activeToday)} of all`} tone="rose" />
        <Kpi icon={Layers} label="Active (7 days)" value={t.active7d} hint={`${t.neverStarted} not started yet`} tone="emerald" />
        <Kpi icon={Clock3} label="Typing minutes (7d)" value={t.minutes7d} hint={`${t.minutesToday} min today`} tone="sky" />
        <Kpi icon={BookOpenCheck} label="Lessons done (7d)" value={t.lessons7d} hint={`${t.lessonsTotal} in total`} tone="violet" />
        <Kpi
          icon={Gauge}
          label="Avg best WPM"
          value={t.avgBestWpm ?? "—"}
          hint={t.avgAccuracy != null ? `Avg test accuracy ${t.avgAccuracy}%` : "No tests in 30 days"}
          tone="amber"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Daily typing" desc="গত ১৪ দিনে সব স্টুডেন্ট মিলে কত মিনিট টাইপ করেছে (বারের উপর মাউস রাখুন)">
          <ActivityChart days={ins.days} />
        </Panel>
        <Panel title="Next steps" desc="কোর্স ঠিকঠাক চালাতে যা বাকি">
          <NextSteps
            steps={[
              { done: overview.courses > 0, label: "Course created", href: `${BASE}/courses` },
              { done: t.batches > 0, label: "At least one batch", hint: "ব্যাচ তৈরি করলে একটা জয়েন কোড পাবেন", href: `${BASE}/batches` },
              {
                done: t.batches > 0 && noTeacher === 0,
                label: noTeacher ? `${noTeacher} batches without a teacher` : "Every batch has a teacher",
                hint: "টিচার অ্যাসাইন করলে তারা নিজের ব্যাচের অগ্রগতি দেখতে পারবে",
                href: `${BASE}/teachers`,
              },
              { done: t.students > 0, label: "Students joined", hint: "স্টুডেন্টরা ASM ব্যাচ থেকে নিজেই যোগ হয়", href: `${BASE}/batches` },
              {
                done: t.students > 0 && t.neverStarted === 0,
                label: t.neverStarted ? `${t.neverStarted} students have not started` : "Everyone has started",
                hint: "তালিকা দেখে মনে করিয়ে দিন",
                href: `${BASE}/students?filter=never`,
              },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title={`Needs attention (${ins.attentionCount})`}
          desc="যারা ৭ দিন টাইপ করেনি, শুরুই করেনি, বা টেস্টে নির্ভুলতা ৮৫%-এর নিচে"
          action={<PanelLink href={`${BASE}/students?filter=attention`}>View all</PanelLink>}
        >
          <AttentionList data={ins} studentHref={student} />
        </Panel>
        <Panel title="Top this week" desc="গত ৭ দিনে সবচেয়ে বেশি সময় টাইপ করেছে">
          <TopStudents items={ins.top} studentHref={student} />
        </Panel>
      </div>

      <Panel title="Batch health" desc="কোন ব্যাচ কতটা সক্রিয়, কার টিচার নেই" action={<PanelLink href={`${BASE}/batches`}>Manage batches</PanelLink>}>
        <BatchHealth batches={ins.batches} hrefFor={(id) => `${BASE}/students?batch=${id}`} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Student features" action={<PanelLink href={`${BASE}/flags`}>Change</PanelLink>}>
          <ul className="flex flex-col gap-2">
            {FEATURES.map((f) => {
              const on = flags.get(f.key) ?? false;
              return (
                <li key={f.key} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--tap-border)] px-3 py-2">
                  <span className="text-sm font-semibold">{f.title}</span>
                  <span className={`tap-badge ${on ? "tap-badge-success" : "tap-badge-neutral"}`}>{on ? "On" : "Off"}</span>
                </li>
              );
            })}
            <li className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--tap-border-strong)] px-3 py-2">
              <span className="text-sm">
                <span className="font-semibold">Ads</span>
                <span className="block text-xs text-ink-muted">পুরো সিস্টেমের জন্য শুধু Super Admin চালু/বন্ধ করেন</span>
              </span>
              <span className={`tap-badge ${ads.enabled ? "tap-badge-warning" : "tap-badge-neutral"}`}>{ads.enabled ? "On" : "Off"}</span>
            </li>
          </ul>
        </Panel>
        <Panel title="Recent changes" desc="ব্যাচ, কোর্স, রোল ও টিচারে কী বদলেছে">
          <AuditFeed entries={overview.recentAudit.slice(0, 8)} />
        </Panel>
      </div>
      <p className="text-center text-xs text-ink-faint">
        তারিখ ও “আজ” বাংলাদেশ সময় অনুযায়ী ·{" "}
        <Link href={`${BASE}/analytics`} className="underline">
          Analytics
        </Link>
      </p>
    </div>
  );
}
