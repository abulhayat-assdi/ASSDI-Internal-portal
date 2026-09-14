import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { StaffNav } from "@/components/typing-game/staff-nav";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireSuperAdmin } from "@/lib/typing-game/server/staff";
import { AuthApiError } from "@/lib/typing-game/server/staff";
import { isLocale, getTranslator, type Locale, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale: Locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  let allowed = false;
  if (client) {
    try {
      await client.rpc("fn_provision_staff_from_asm");
    } catch (err) {
      console.error("[typing-game] fn_provision_staff_from_asm failed:", err);
    }
    try {
      await requireSuperAdmin(client);
      allowed = true;
    } catch (e) {
      if (!(e instanceof AuthApiError)) throw e;
    }
  }
  if (!allowed) return <ForbiddenBlock locale={locale} />;
  const t = getTranslator(locale, "staff");
  const base = `/dashboard/typing-game/super-admin`;
  return (
    <div className="min-h-screen bg-canvas">
      <StaffNav
        locale={locale}
        homeHref={base}
        items={[
          { href: base, label: t("superDashboard") },
          { href: `${base}/audit`, label: t("auditLog") },
          { href: `${base}/flags`, label: t("featureFlags") },
        ]}
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
