import { Clock3, Flame, Gauge, Layers, Target, Users } from "lucide-react";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { loadInsights } from "@/lib/typing-game/server/insights";
import { ActivityChart } from "@/components/typing-game/staff/activity-chart";
import { BatchCards } from "@/components/typing-game/staff/batch-cards";
import { AttentionList, ConsoleHero, HeroLink, Kpi, Panel, TopStudents } from "@/components/typing-game/staff/blocks";
import { EmptyState } from "@/components/typing-game/ui";

export const dynamic = "force-dynamic";

const BASE = "/dashboard/typing-game/teacher";

export default async function TeacherDashboardPage() {
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <EmptyState title="Teacher Console" />;
  const ins = await loadInsights(client);
  const t = ins.totals;
  const student = (id: string) => `${BASE}/students/${id}`;

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        tone="teacher"
        kicker="Teacher Console"
        title="My Classes"
        desc={
          t.students === 0
            ? "আপনার ব্যাচে এখনো কোনো স্টুডেন্ট নেই।"
            : `আজ ${t.activeToday}/${t.students} জন টাইপ করেছে। ${ins.attentionCount} জনের দিকে নজর দেওয়া দরকার।`
        }
      >
        <HeroLink href={`${BASE}/missions/new`}>
          <Target className="h-4 w-4" aria-hidden="true" /> New mission
        </HeroLink>
      </ConsoleHero>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={Users} label="My students" value={t.students} hint={`In ${t.batches} batches`} tone="emerald" />
        <Kpi icon={Flame} label="Active today" value={t.activeToday} hint={`${t.minutesToday} min typed today`} tone="rose" />
        <Kpi icon={Layers} label="Active (7 days)" value={t.active7d} hint={`${t.neverStarted} not started`} tone="sky" />
        <Kpi icon={Clock3} label="Lessons done (7d)" value={t.lessons7d} hint={`${t.minutes7d} min typed`} tone="violet" />
        <Kpi icon={Gauge} label="Avg best WPM" value={t.avgBestWpm ?? "—"} hint={t.avgAccuracy != null ? `Accuracy ${t.avgAccuracy}%` : "No tests in 30 days"} tone="amber" />
      </div>

      <Panel title="My batches" desc="ব্যাচে ক্লিক করলে প্রত্যেক স্টুডেন্টের লেসন-ভিত্তিক অগ্রগতি দেখা যাবে">
        <BatchCards batches={ins.batches} hrefFor={(id) => `${BASE}/batches/${id}`} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={`Needs attention (${ins.attentionCount})`} desc="৭ দিন টাইপ করেনি, শুরুই করেনি, বা টেস্টে নির্ভুলতা ৮৫%-এর নিচে">
          <AttentionList data={ins} studentHref={student} />
        </Panel>
        <Panel title="Top this week" desc="সবচেয়ে বেশি সময় টাইপ করেছে">
          <TopStudents items={ins.top} studentHref={student} />
        </Panel>
      </div>

      <Panel title="Daily typing" desc="আমার সব স্টুডেন্ট মিলে, গত ১৪ দিন">
        <ActivityChart days={ins.days} />
      </Panel>
    </div>
  );
}
