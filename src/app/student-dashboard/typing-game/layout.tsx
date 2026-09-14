import { redirect } from "next/navigation";
import { StudentNav } from "@/components/typing-game/student-nav";
import { getSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { getCurrentActor } from "@/lib/typing-game/server/staff";
import { isLocale, type Locale, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { loginUrl } from "@/lib/typing-game/routes";

/**
 * Student area gate (backstop — middleware normally redirects first, with
 * the destination preserved). Requires an ACTIVE account: suspended or
 * inactive users land on /suspended with zero private data rendered.
 * No admin functionality lives under here.
 *
 * force-dynamic is load-bearing: getSession() reads cookies() inside a
 * try/catch (fail-closed nulls), which would otherwise swallow Next's
 * dynamic bailout and bake a logged-out redirect into static HTML.
 */
export const dynamic = "force-dynamic";
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale: Locale = DEFAULT_LOCALE;
  const session = await getSession();
  if (!session) redirect(loginUrl(locale));
  const client = await userDbClient();
  // First-time visit: no typing_game.profiles/user_roles/batch_members row
  // exists for this ASM student yet. Provisioning is idempotent (ON CONFLICT
  // DO NOTHING throughout fn_provision_from_asm) and cheap after the first
  // call, so it's safe to call on every layout render rather than tracking
  // "have we already provisioned this session" separately.
  if (client) {
    try {
      await client.rpc("fn_provision_from_asm");
    } catch (err) {
      console.error("[typing-game] fn_provision_from_asm failed:", err);
    }
  }
  const actor = client ? await getCurrentActor(client) : null;
  if (!actor || actor.status !== "active") {
    redirect(`/student-dashboard/typing-game/suspended`);
  }
  return (
    <div className="min-h-screen bg-canvas">
      <StudentNav locale={locale} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}
