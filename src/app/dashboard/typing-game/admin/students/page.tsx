import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { dhakaToday, loadStaffStudents } from "@/lib/typing-game/server/insights";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { ConsoleHero, Panel } from "@/components/typing-game/staff/blocks";
import {
  STUDENT_FILTERS,
  StudentFilters,
  StudentTable,
  applyStudentFilter,
  type StudentFilter,
} from "@/components/typing-game/staff/student-table";

export const dynamic = "force-dynamic";

const BASE = "/dashboard/typing-game/admin/students";

export default async function StudentsPage(props: { searchParams: Promise<{ q?: string; batch?: string; filter?: string }> }) {
  const sp = await props.searchParams;
  const locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let batches: { id: string; name: string }[] = [];
  try {
    const { orgIds } = await requireAdmin(client);
    batches = (await createSupabaseStaffStore(client).listBatches(orgIds)).map((b) => ({ id: b.id, name: b.name }));
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }
  const q = sp.q ?? "";
  const batch = batches.some((b) => b.id === sp.batch) ? (sp.batch as string) : "";
  const filter = (STUDENT_FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "all") as StudentFilter;
  const today = dhakaToday();
  const all = await loadStaffStudents(client, { q, batchIds: batch ? [batch] : undefined, limit: 1000 });
  const counts = Object.fromEntries(STUDENT_FILTERS.map((f) => [f.key, applyStudentFilter(all, f.key, today).length])) as Record<
    StudentFilter,
    number
  >;
  const rows = applyStudentFilter(all, filter, today);

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        kicker="Students"
        title="Students"
        desc="প্রত্যেকের লেভেল, শেষ করা লেসন, সেরা টেস্ট স্পিড আর শেষ কবে টাইপ করেছে। নামে ক্লিক করলে বিস্তারিত ও ব্যাচ/রোল/স্ট্যাটাস বদলানো যায়।"
      />
      <Panel title={`${rows.length} students`} desc={batch ? batches.find((b) => b.id === batch)?.name : "All batches"}>
        <StudentFilters action={BASE} q={q} batch={batch} filter={filter} batches={batches} counts={counts} />
        <StudentTable rows={rows} today={today} hrefFor={(id) => `${BASE}/${id}`} />
      </Panel>
    </div>
  );
}
