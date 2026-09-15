import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { StaffNav } from "@/components/typing-game/staff-nav";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { requireTeacher } from "@/lib/typing-game/server/staff";
import { AuthApiError } from "@/lib/typing-game/server/staff";
import { isLocale, getTranslator, type Locale, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getServerSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({
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
      await requireTeacher(client);
      // requireTeacher only checks the typing_game bridge role (any ASM
      // teacher gets that) — the Teacher Console itself, missions included,
      // is further gated behind the admin-granted typing_game_teacher
      // permission so an admin can opt specific teachers in/out.
      const asmUser = await getServerSessionUser();
      allowed =
        !!asmUser &&
        hasPermission(asmUser.role, asmUser.permissions ?? null, "typing_game_teacher");
    } catch (e) {
      if (!(e instanceof AuthApiError)) throw e;
    }
  }
  if (!allowed) return <ForbiddenBlock locale={locale} />;
  const t = getTranslator(locale, "staff");
  const tn = getTranslator(locale, "nav");
  return (
    <div className="min-h-screen bg-canvas">
      <StaffNav
        locale={locale}
        homeHref={`/dashboard/typing-game/teacher`}
        items={[
          { href: `/dashboard/typing-game/teacher`, label: t("teacherDashboard") },
          {
            href: `/dashboard/typing-game/teacher/missions`,
            label: tn("missions"),
          },
          {
            href: `/dashboard/typing-game/teacher/competitions`,
            label: tn("competitions"),
          },
          {
            href: `/dashboard/typing-game/teacher/clan`,
            label: tn("clan"),
          },
        ]}
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
