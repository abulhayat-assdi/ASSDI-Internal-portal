import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { StaffNav } from "@/components/typing-game/staff-nav";
import "@/styles/typing-game-theme.css";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { AuthApiError } from "@/lib/typing-game/server/staff";
import { isLocale, getTranslator, type Locale, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale: Locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  let allowed = false;
  if (client) {
    // First-time visit: no typing_game.profiles/user_roles row yet for this
    // ASM admin — idempotent, cheap after the first call (see
    // fn_provision_staff_from_asm, 0041_staff_provisioning_and_flags.sql).
    try {
      await client.rpc("fn_provision_staff_from_asm");
    } catch (err) {
      console.error("[typing-game] fn_provision_staff_from_asm failed:", err);
    }
    try {
      await requireAdmin(client);
      allowed = true;
    } catch (e) {
      if (!(e instanceof AuthApiError)) throw e;
    }
  }
  if (!allowed) return <ForbiddenBlock locale={locale} />;
  const t = getTranslator(locale, "staff");
  const tn = getTranslator(locale, "nav");
  const base = `/dashboard/typing-game/admin`;
  return (
    <div className="tap-scope min-h-screen bg-canvas">
      <StaffNav
        locale={locale}
        homeHref={base}
        items={[
          { href: base, label: t("adminDashboard") },
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
        ]}
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
