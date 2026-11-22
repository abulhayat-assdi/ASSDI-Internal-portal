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
        title="আমার ক্লাস"
        desc={
          t.students === 0
            ? "আপনার ব্যাচে এখনো কোনো স্টুডেন্ট নেই।"
            : `আজ ${t.activeToday}/${t.students} জন টাইপ করেছে। ${ins.attentionCount} জনের দিকে নজর দেওয়া দরকার।`
        }
      >
        <HeroLink href={`${BASE}/missions/new`}>
          <Target className="h-4 w-4" aria-hidden="true" /> নতুন মিশন দিন
        </HeroLink>
      </ConsoleHero>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={Users} label="আমার স্টুডেন্ট" value={t.students} hint={`${t.batches}টা ব্যাচে`} tone="emerald" />
        <Kpi icon={Flame} label="আজ সক্রিয়" value={t.activeToday} hint={`আজ ${t.minutesToday} মিনিট টাইপ`} tone="rose" />
        <Kpi icon={Layers} label="৭ দিনে সক্রিয়" value={t.active7d} hint={`${t.neverStarted} জন শুরুই করেনি`} tone="sky" />
        <Kpi icon={Clock3} label="লেসন শেষ (৭ দিন)" value={t.lessons7d} hint={`${t.minutes7d} মিনিট টাইপ`} tone="violet" />
        <Kpi icon={Gauge} label="গড় সেরা WPM" value={t.avgBestWpm ?? "—"} hint={t.avgAccuracy != null ? `নির্ভুলতা ${t.avgAccuracy}%` : "৩০ দিনে টেস্ট নেই"} tone="amber" />
      </div>

      <Panel title="আমার ব্যাচ" desc="ব্যাচে ক্লিক করলে প্রত্যেক স্টুডেন্টের লেসন-ভিত্তিক অগ্রগতি দেখা যাবে">
        <BatchCards batches={ins.batches} hrefFor={(id) => `${BASE}/batches/${id}`} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={`নজর দিন (${ins.attentionCount})`} desc="৭ দিন টাইপ করেনি, শুরুই করেনি, বা টেস্টে নির্ভুলতা ৮৫%-এর নিচে">
          <AttentionList data={ins} studentHref={student} />
        </Panel>
        <Panel title="এই সপ্তাহের সেরা" desc="সবচেয়ে বেশি সময় টাইপ করেছে">
          <TopStudents items={ins.top} studentHref={student} />
        </Panel>
      </div>

      <Panel title="দৈনিক টাইপিং" desc="আমার সব স্টুডেন্ট মিলে, গত ১৪ দিন">
        <ActivityChart days={ins.days} />
      </Panel>
    </div>
  );
}
