import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { FlagToggle } from "@/components/typing-game/admin-forms";

/**
 * Per-Course flag control — the org-admin counterpart to
 * super-admin/flags/page.tsx. A super_admin visiting this page sees their
 * global defaults (orgIds === null passes null through, same as the
 * super-admin page); an org admin sees/edits their own org's overrides only
 * (requireAdmin's orgIds[0]), never another Course's.
 */
export default async function AdminFlagsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "staff");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let flags: Array<{ key: string; enabled: boolean; description: string }> = [];
  try {
    const { orgIds } = await requireAdmin(client);
    const orgId = orgIds === null ? null : (orgIds[0] ?? null);
    flags = await createSupabaseStaffStore(client).getFlags(orgId);
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("featureFlags")} />
      <Card>
        <CardContent>
          <div className="flex flex-col gap-2">
            {flags.map((f) => (
              <FlagToggle
                key={f.key}
                locale={locale}
                flagKey={f.key}
                enabled={f.enabled}
                description={f.description}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
