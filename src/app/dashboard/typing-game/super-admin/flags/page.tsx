import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireSuperAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { FlagToggle } from "@/components/typing-game/admin-forms";

export default async function SuperFlagsPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "staff");
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let flags: Array<{ key: string; enabled: boolean; description: string }> = [];
  try {
    await requireSuperAdmin(client);
    flags = await createSupabaseStaffStore(client).getFlags();
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
