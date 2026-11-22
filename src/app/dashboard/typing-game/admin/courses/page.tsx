import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { CreateCourseForm, PatchToggle } from "@/components/typing-game/admin-forms";
import { ConsoleHero, Empty, Panel } from "@/components/typing-game/staff/blocks";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let courses: { id: string; title: string; slug: string; isActive: boolean }[] = [];
  let batches: { courseId: string; isActive: boolean }[] = [];
  let orgId = "";
  try {
    const { orgIds } = await requireAdmin(client);
    const store = createSupabaseStaffStore(client);
    [courses, batches] = await Promise.all([store.listCourses(orgIds), store.listBatches(orgIds)]);
    orgId = orgIds?.[0] ?? (await store.listOrgs())[0]?.id ?? "";
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        kicker="Courses"
        title="কোর্স"
        desc="কোর্স হলো ব্যাচগুলোর ঘর। সাধারণত একটাই কোর্স (Typing Adventure) যথেষ্ট; লেসন, টেস্ট ও গেম সব কোর্সে একই থাকে।"
      />
      <Panel title="নতুন কোর্স">
        <CreateCourseForm locale={locale} orgId={orgId} />
      </Panel>
      <Panel title={`সব কোর্স (${courses.length})`}>
        {courses.length === 0 ? (
          <Empty>এখনো কোনো কোর্স নেই।</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tap-table w-full text-sm">
              <thead>
                <tr>
                  <th scope="col" className="text-left">কোর্স</th>
                  <th scope="col" className="text-right">ব্যাচ</th>
                  <th scope="col" className="text-left">অবস্থা</th>
                  <th scope="col" className="text-right">কাজ</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const n = batches.filter((b) => b.courseId === c.id);
                  return (
                    <tr key={c.id}>
                      <th scope="row" className="text-left">
                        <span className="font-semibold">{c.title}</span>
                        <span className="block font-mono text-xs font-normal text-ink-faint">{c.slug}</span>
                      </th>
                      <td className="text-right tabular-nums">
                        {n.filter((b) => b.isActive).length} চালু / {n.length}
                      </td>
                      <td>
                        <span className={`tap-badge ${c.isActive ? "tap-badge-success" : "tap-badge-neutral"}`}>{c.isActive ? "চালু" : "বন্ধ"}</span>
                      </td>
                      <td className="text-right">
                        <PatchToggle
                          locale={locale}
                          url={`/api/typing-game/admin/courses/${c.id}`}
                          body={{ isActive: !c.isActive }}
                          label={c.isActive ? "বন্ধ করুন" : "চালু করুন"}
                          active={c.isActive}
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
