import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Card, CardContent, EmptyState, PageHeader, SectionHeader, StatCard } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
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
  const tn = getTranslator(locale, "nav");
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

  const base = `/dashboard/typing-game/admin`;
  const actions: Array<{ href: string; label: string }> = [
    { href: `${base}/courses`, label: t("courses") },
    { href: `${base}/batches`, label: t("batches") },
    { href: `${base}/students`, label: t("students") },
    { href: `${base}/teachers`, label: t("teachers") },
    { href: `${base}/competitions`, label: tn("adminCompetitions") },
    { href: `${base}/clans`, label: tn("adminClans") },
    { href: `${base}/wars`, label: tn("adminWars") },
    { href: `${base}/bosses`, label: tn("adminBosses") },
    { href: `${base}/seasons`, label: tn("adminSeasons") },
    { href: `${base}/flags`, label: t("featureFlags") },
  ];

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
          <SectionHeader title={t("quickActions")} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="tap-card tap-card-interactive flex items-center justify-between gap-2 p-3"
              >
                <span className="text-sm font-semibold">{a.label}</span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SectionHeader title={t("auditLog")} />
          {overview.recentAudit.length === 0 ? (
            <EmptyState title={t("auditLog")} description={t("noResults")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="tap-table">
                <thead>
                  <tr>
                    <th scope="col">{t("action")}</th>
                    <th scope="col">{t("entity")}</th>
                    <th scope="col">{t("time")}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentAudit.slice(0, 8).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Badge tone="primary">{a.action}</Badge>
                      </td>
                      <td>
                        <Badge tone="neutral">{a.entity}</Badge>
                      </td>
                      <td className="text-ink-muted">
                        {a.createdAt.slice(0, 16).replace("T", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
