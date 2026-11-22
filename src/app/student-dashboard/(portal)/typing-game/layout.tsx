import "@/styles/typing-game-theme.css";
import { StudentNav } from "@/components/typing-game/student-nav";
import { getSession, handleMissingSession } from "@/lib/typing-game/server/auth";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { getCurrentActor } from "@/lib/typing-game/server/staff";
import { isLocale, type Locale, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { SuspendedNotice } from "@/components/typing-game/suspended-notice";
import { TypingContainer } from "@/components/typing-game/typing-container";
import { AdsProvider, type AllowedSlots } from "@/components/typing-game/ads/ads-context";
import { createAdsStore } from "@/lib/typing-game/server/ads-store";
import { AD_SLOTS, displaySlot } from "@/lib/typing-game/ads/settings";
import { myFeatures } from "@/lib/typing-game/server/features";
import { createChallengeStore } from "@/lib/typing-game/server/challenge-store";

/**
 * Student area gate (backstop — middleware normally redirects first, with
 * the destination preserved). Requires an ACTIVE account: suspended or
 * inactive users get the suspended notice rendered INLINE (never a redirect:
 * /suspended lives under this same layout, so redirecting there would re-run
 * this gate forever) with zero private data rendered.
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
  if (!session) return await handleMissingSession();
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
    return (
      <div className="tap-scope min-h-screen bg-canvas">
        <SuspendedNotice
          locale={locale}
          reason={actor ? "suspended" : "provisioning"}
        />
      </div>
    );
  }
  // Display-ad slots this student may see (none while ads are off).
  const slots: AllowedSlots = {};
  if (client) {
    const ads = createAdsStore(client);
    const settings = await ads.settings();
    if (settings.enabled && settings.displayEnabled) {
      const batchIds = await ads.myBatchIds(session.userId);
      for (const s of AD_SLOTS) {
        const cfg = displaySlot(settings, s.key, batchIds);
        if (cfg) slots[s.key] = cfg;
      }
    }
  }
  // Feature switches (admin-controlled) and waiting challenges for the nav.
  const features = await myFeatures(client);
  const competeBadge =
    client && features.BATCH_COMPETITION_ENABLED ? await createChallengeStore(client).inboxCount() : 0;
  return (
    <AdsProvider slots={slots}>
    <div className="tap-scope bg-canvas" style={{ minHeight: "calc(100dvh - 7rem)" }}>
      <div className="tap-ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <StudentNav locale={locale} features={features} competeBadge={competeBadge} />
      <TypingContainer>{children}</TypingContainer>
    </div>
    </AdsProvider>
  );
}
