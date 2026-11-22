import Link from "next/link";
import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { loadInsights } from "@/lib/typing-game/server/insights";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { CreateBatchForm, PatchToggle } from "@/components/typing-game/admin-forms";
import { ConsoleHero, Empty, Panel } from "@/components/typing-game/staff/blocks";

export const dynamic = "force-dynamic";

type BatchRow = Awaited<ReturnType<ReturnType<typeof createSupabaseStaffStore>["listBatches"]>>[number];

export default async function BatchesPage() {
  const locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let batches: BatchRow[] = [];
  let courses: { id: string; title: string }[] = [];
  try {
    const { orgIds } = await requireAdmin(client);
    const store = createSupabaseStaffStore(client);
    [batches, courses] = await Promise.all([store.listBatches(orgIds), store.listCourses(orgIds)]);
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }
  const ins = await loadInsights(client);
  const stats = new Map(ins.batches.map((b) => [b.id, b]));
  const sorted = [...batches].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        kicker="Batches"
        title="ব্যাচ"
        desc="প্রতিটা ব্যাচের স্টুডেন্ট, সাপ্তাহিক সক্রিয়তা আর টিচার এক জায়গায়। ব্যাচ বন্ধ করলে নতুন কেউ জয়েন করতে পারবে না, ব্যাচের ভেতরে কম্পিটিশনও বন্ধ থাকবে।"
      />
      <Panel title="নতুন ব্যাচ" desc="ASM-এর ব্যাচ থেকে স্টুডেন্টরা নিজে থেকেই যোগ হয়। আলাদা ব্যাচ লাগলে এখানে তৈরি করুন।">
        <CreateBatchForm locale={locale} courses={courses} />
      </Panel>
      <Panel title={`সব ব্যাচ (${batches.length})`}>
        {sorted.length === 0 ? (
          <Empty>এখনো কোনো ব্যাচ নেই। উপরের ফর্ম থেকে প্রথম ব্যাচটা তৈরি করুন।</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tap-table w-full text-sm">
              <thead>
                <tr>
                  <th scope="col" className="text-left">ব্যাচ</th>
                  <th scope="col" className="text-left">জয়েন কোড</th>
                  <th scope="col" className="text-left">টিচার</th>
                  <th scope="col" className="text-right">স্টুডেন্ট</th>
                  <th scope="col" className="text-right">৭ দিনে সক্রিয়</th>
                  <th scope="col" className="text-right">মিনিট (৭ দিন)</th>
                  <th scope="col" className="text-left">অবস্থা</th>
                  <th scope="col" className="text-right">কাজ</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => {
                  const s = stats.get(b.id);
                  return (
                    <tr key={b.id} className={b.isActive ? "" : "opacity-60"}>
                      <th scope="row" className="text-left">
                        <Link href={`/dashboard/typing-game/admin/students?batch=${b.id}`} className="font-semibold hover:underline">
                          {b.name}
                        </Link>
                        <span className="block text-xs font-normal text-ink-faint">{b.courseName}</span>
                      </th>
                      <td>
                        <code className="rounded bg-[var(--tap-primary-50)] px-1.5 py-0.5 text-xs">{b.joinCode}</code>
                      </td>
                      <td className="text-xs">
                        {s?.teachers.length ? (
                          s.teachers.join(", ")
                        ) : (
                          <Link href="/dashboard/typing-game/admin/teachers" className="font-semibold text-amber-600 hover:underline">
                            টিচার দিন
                          </Link>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{s?.members ?? 0}</td>
                      <td className="text-right tabular-nums">{s?.active7d ?? 0}</td>
                      <td className="text-right tabular-nums">{s?.minutes7d ?? 0}</td>
                      <td>
                        <span className={`tap-badge ${b.isActive ? "tap-badge-success" : "tap-badge-neutral"}`}>{b.isActive ? "চালু" : "বন্ধ"}</span>
                      </td>
                      <td className="text-right">
                        <PatchToggle
                          locale={locale}
                          url={`/api/typing-game/admin/batches/${b.id}`}
                          body={{ isActive: !b.isActive }}
                          label={b.isActive ? "বন্ধ করুন" : "চালু করুন"}
                          active={b.isActive}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
