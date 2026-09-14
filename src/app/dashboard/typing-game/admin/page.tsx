import { Card, CardContent, PageHeader, StatCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { getAdminOverview } from "@/lib/typing-game/server/staff-data";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "staff");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let overview;
  try {
    const { orgIds } = await requireAdmin(client);
    overview = await getAdminOverview(orgIds, createSupabaseStaffStore(client));
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("adminDashboard")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("courses")} value={overview.courses} />
        <StatCard label={t("batches")} value={overview.batches} />
        <StatCard label={t("teachers")} value={overview.teachers} />
        <StatCard label={t("organizations")} value={overview.orgs.length} />
      </div>
      <Card>
        <CardContent>
          <h2 className="mb-2 text-base font-bold">{t("auditLog")}</h2>
          {overview.recentAudit.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noResults")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {overview.recentAudit.slice(0, 8).map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>
                    {a.action} · {a.entity}
                  </span>
                  <span className="text-ink-muted">{a.createdAt.slice(0, 16).replace("T", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
