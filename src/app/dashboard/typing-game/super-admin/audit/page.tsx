import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { requireSuperAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { ConsoleHero, Empty, Panel, auditLabel } from "@/components/typing-game/staff/blocks";

export const dynamic = "force-dynamic";

export default async function SuperAuditPage() {
  const locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let rows: { id: number | string; action: string; entity: string; entityId: string; createdAt: string }[] = [];
  try {
    await requireSuperAdmin(client);
    rows = await createSupabaseStaffStore(client).getAudit(100);
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }
  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero tone="super" kicker="Audit log" title="পরিবর্তনের খাতা" desc="কোর্স, ব্যাচ, টিচার অ্যাসাইনমেন্ট, রোল আর ব্যাচ মেম্বারশিপে শেষ ১০০টা পরিবর্তন।" />
      <Panel title={`${rows.length}টা এন্ট্রি`}>
        {rows.length === 0 ? (
          <Empty>এখনো কোনো পরিবর্তন নেই।</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tap-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">কী হয়েছে</th>
                  <th className="text-left">টেবিল</th>
                  <th className="text-left">আইডি</th>
                  <th className="text-right">সময় (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="font-semibold">{auditLabel(a.action)}</td>
                    <td className="font-mono text-xs">{a.entity}</td>
                    <td className="font-mono text-xs text-ink-faint">{a.entityId.slice(0, 8)}</td>
                    <td className="text-right text-xs tabular-nums">{a.createdAt.slice(0, 16).replace("T", " ")}</td>
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
