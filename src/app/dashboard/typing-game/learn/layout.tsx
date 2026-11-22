import "@/styles/typing-game-theme.css";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { StaffNav, type StaffNavItem } from "@/components/typing-game/staff-nav";
import { StudentNav } from "@/components/typing-game/student-nav";
import { TypingContainer } from "@/components/typing-game/typing-container";
import { AdsProvider } from "@/components/typing-game/ads/ads-context";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { myFeatures } from "@/lib/typing-game/server/features";
import { DEFAULT_LOCALE, type Locale } from "@/lib/typing-game/i18n";
import { getServerSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { LEARN_BASE } from "@/lib/typing-game/base";

export const dynamic = "force-dynamic";

/**
 * A teacher's or admin's own Typing Adventure: the same lessons, practice,
 * tests, games and progress students have, without missions, competition or
 * leaderboard, and never with ads. Staff are in no batch, so nothing here
 * shows up in student leaderboards or the staff dashboards.
 */
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const locale: Locale = DEFAULT_LOCALE;
  const asmUser = await getServerSessionUser();
  const perms = asmUser?.permissions ?? null;
  const allowed =
    !!asmUser && asmUser.role !== "student" && hasPermission(asmUser.role, perms, "typing_game_learn");
  const session = allowed ? await getSession() : null;
  const client = session ? await userDbClient() : null;
  if (!asmUser || !allowed || !session || !client) return <ForbiddenBlock locale={locale} />;
  // Creates the typing profile on a first visit (idempotent).
  try {
    await client.rpc("fn_provision_staff_from_asm");
  } catch (err) {
    console.error("[typing-game] fn_provision_staff_from_asm failed:", err);
  }

  const teacher = hasPermission(asmUser.role, perms, "typing_game_teacher");
  const admin = hasPermission(asmUser.role, perms, "admin_typing_game");
  const items: StaffNavItem[] = [];
  if (teacher) {
    const t = "/dashboard/typing-game/teacher";
    items.push(
      { href: t, label: "Overview", icon: "overview", exact: true },
      { href: `${t}/batches`, label: "My batches", icon: "batches" },
      { href: `${t}/missions`, label: "Missions", icon: "missions" },
    );
  } else if (admin) {
    items.push({ href: "/dashboard/typing-game/admin", label: "Admin console", icon: "overview", exact: true });
  }
  items.push({ href: LEARN_BASE, label: "আমার প্র্যাকটিস", icon: "lessons" });
  const features = await myFeatures(client);

  return (
    <AdsProvider slots={{}}>
      <div className="tap-scope min-h-screen bg-canvas">
        <StaffNav locale={locale} homeHref={items[0].href} role={teacher ? "Teacher" : "Admin"} items={items} />
        <StudentNav locale={locale} features={features} staff />
        <TypingContainer>{children}</TypingContainer>
      </div>
    </AdsProvider>
  );
}
