import { Card, CardContent, PageHeader, StatCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireSuperAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { getAdminOverview } from "@/lib/typing-game/server/staff-data";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";

export default async function SuperAdminPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "staff");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let overview;
  try {
    await requireSuperAdmin(client);
    overview = await getAdminOverview(null, createSupabaseStaffStore(client));
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("superDashboard")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("organizations")} value={overview.orgs.length} />
        <StatCard label={t("courses")} value={overview.courses} />
        <StatCard label={t("batches")} value={overview.batches} />
        <StatCard label={t("teachers")} value={overview.teachers} />
      </div>
      <Card>
        <CardContent>
          <h2 className="mb-2 text-base font-bold">{t("organizations")}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {overview.orgs.map((o) => (
              <li key={o.id} className="flex justify-between gap-3">
                <span>{o.name}</span>
                <span className="font-mono text-xs text-ink-faint">{o.slug}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
