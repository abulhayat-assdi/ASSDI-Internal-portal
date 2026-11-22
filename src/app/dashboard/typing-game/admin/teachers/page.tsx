import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { loadInsights, loadStaffTeachers } from "@/lib/typing-game/server/insights";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { AssignmentForm, DeleteButton } from "@/components/typing-game/admin-forms";
import { ConsoleHero, Empty, Panel } from "@/components/typing-game/staff/blocks";

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let courses: { id: string; title: string }[] = [];
  let batches: { id: string; name: string }[] = [];
  try {
    const { orgIds } = await requireAdmin(client);
    const store = createSupabaseStaffStore(client);
    const [c, b] = await Promise.all([store.listCourses(orgIds), store.listBatches(orgIds)]);
    courses = c;
    batches = b.filter((x) => x.isActive).map((x) => ({ id: x.id, name: x.name }));
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }
  const [rows, ins] = await Promise.all([loadStaffTeachers(client), loadInsights(client)]);
  const uncovered = ins.batches.filter((b) => b.active && b.teachers.length === 0);

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        kicker="Teachers"
        title="টিচার"
        desc="টিচারকে কোর্স বা নির্দিষ্ট ব্যাচে অ্যাসাইন করুন। অ্যাসাইন করা টিচার Teacher Console-এ নিজের স্টুডেন্টদের লেসন, টেস্ট, গেম আর কম্পিটিশনের অগ্রগতি দেখতে পায়।"
      />
      {uncovered.length ? (
        <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <b>{uncovered.length}টা চালু ব্যাচে টিচার নেই:</b> {uncovered.map((b) => b.name).join(", ")}
        </div>
      ) : null}
      <Panel title="টিচার অ্যাসাইন করুন" desc="টিচারের ASM ইমেইল দিন। কোর্স বেছে নিলে ঐ কোর্সের সব ব্যাচ তার আওতায় আসবে।">
        <AssignmentForm locale={locale} courses={courses} batches={batches} />
      </Panel>
      <Panel title={`অ্যাসাইনমেন্ট (${rows.length})`}>
        {rows.length === 0 ? (
          <Empty>এখনো কোনো টিচার অ্যাসাইন করা হয়নি।</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tap-table w-full text-sm">
              <thead>
                <tr>
                  <th scope="col" className="text-left">টিচার</th>
                  <th scope="col" className="text-left">দায়িত্ব</th>
                  <th scope="col" className="text-right">স্টুডেন্ট</th>
                  <th scope="col" className="text-right">কাজ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <th scope="row" className="text-left">
                      <span className="font-semibold">{a.name}</span>
                      <span className="block text-xs font-normal text-ink-faint">{a.email}</span>
                    </th>
                    <td>
                      <span className={`tap-badge ${a.scope === "course" ? "tap-badge-primary" : "tap-badge-neutral"}`}>
                        {a.scope === "course" ? "পুরো কোর্স" : "ব্যাচ"}
                      </span>{" "}
                      {a.target}
                    </td>
                    <td className="text-right tabular-nums">{a.students}</td>
                    <td className="text-right">
                      <DeleteButton locale={locale} url={`/api/typing-game/admin/assignments/${a.id}`} label="সরান" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
