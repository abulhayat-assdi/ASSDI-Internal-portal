import { notFound } from "next/navigation";
import { Clock3, Flame, Gauge, Users } from "lucide-react";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { dhakaToday, loadInsights, loadStaffStudents } from "@/lib/typing-game/server/insights";
import { loadBatchProgress } from "@/lib/typing-game/server/batch-progress";
import { BatchLessonGrid } from "@/components/typing-game/batch-lesson-grid";
import { ActivityChart } from "@/components/typing-game/staff/activity-chart";
import { AttentionList, ConsoleHero, HeroLink, Kpi, Panel } from "@/components/typing-game/staff/blocks";
import {
  STUDENT_FILTERS,
  StudentFilters,
  StudentTable,
  applyStudentFilter,
  type StudentFilter,
} from "@/components/typing-game/staff/student-table";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TeacherBatchPage(props: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ level?: string; q?: string; filter?: string }>;
}) {
  const { batchId } = await props.params;
  const sp = await props.searchParams;
  if (!UUID.test(batchId)) notFound();
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) notFound();
  // Scope is the database's: a batch the teacher does not teach comes back empty.
  const ins = await loadInsights(client, [batchId]);
  const batch = ins.batches.find((b) => b.id === batchId);
  if (!batch) notFound();

  const today = dhakaToday();
  const q = sp.q ?? "";
  const filter = (STUDENT_FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "all") as StudentFilter;
  const all = await loadStaffStudents(client, { batchIds: [batchId], q, limit: 1000 });
  const counts = Object.fromEntries(STUDENT_FILTERS.map((f) => [f.key, applyStudentFilter(all, f.key, today).length])) as Record<
    StudentFilter,
    number
  >;
  const rows = applyStudentFilter(all, filter, today);
  const base = `/dashboard/typing-game/teacher/batches/${batchId}`;
  const lessonProgress = await loadBatchProgress(
    client,
    all.map((r) => r.userId),
  ).catch(() => new Map());
  const t = ins.totals;
  const student = (id: string) => `/dashboard/typing-game/teacher/students/${id}`;

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        tone="teacher"
        kicker={`${batch.course} · জয়েন কোড ${batch.joinCode}`}
        title={batch.name}
        desc={batch.teachers.length ? `টিচার: ${batch.teachers.join(", ")}` : undefined}
      >
        <HeroLink href="/dashboard/typing-game/teacher/missions/new">এই ব্যাচকে মিশন দিন</HeroLink>
      </ConsoleHero>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Users} label="স্টুডেন্ট" value={t.students} hint={`${t.neverStarted} জন শুরু করেনি`} tone="emerald" />
        <Kpi icon={Flame} label="আজ / ৭ দিনে সক্রিয়" value={`${t.activeToday} / ${t.active7d}`} tone="rose" />
        <Kpi icon={Clock3} label="মিনিট (৭ দিন)" value={t.minutes7d} hint={`${t.lessons7d}টা লেসন শেষ`} tone="sky" />
        <Kpi icon={Gauge} label="গড় সেরা WPM" value={t.avgBestWpm ?? "—"} hint={t.avgAccuracy != null ? `নির্ভুলতা ${t.avgAccuracy}%` : undefined} tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="দৈনিক টাইপিং" desc="এই ব্যাচ, গত ১৪ দিন">
          <ActivityChart days={ins.days} />
        </Panel>
        <Panel title={`নজর দিন (${ins.attentionCount})`}>
          <AttentionList data={ins} studentHref={student} />
        </Panel>
      </div>

      <Panel title="স্টুডেন্ট" desc="নামে ক্লিক করলে লেসন, টেস্ট, গেম ও কম্পিটিশনের বিস্তারিত">
        <StudentFilters action={base} q={q} batch="" filter={filter} counts={counts} />
        <StudentTable rows={rows} today={today} hrefFor={student} showBatch={false} />
      </Panel>

      <BatchLessonGrid
        members={all.map((m) => ({ userId: m.userId, fullName: m.name, rollNumber: m.roll }))}
        progress={lessonProgress}
        levelId={sp.level ?? null}
        baseHref={base}
      />
    </div>
  );
}
