import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { requireSuperAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { FEATURES } from "@/lib/typing-game/features";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { ConsoleHero, Panel } from "@/components/typing-game/staff/blocks";
import { FeatureSwitches } from "@/components/typing-game/staff/feature-switches";

export const dynamic = "force-dynamic";

/** Platform defaults for the student features; each course admin may override for their course. */
export default async function SuperFlagsPage() {
  const locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let flags: { key: string; enabled: boolean }[] = [];
  try {
    await requireSuperAdmin(client);
    flags = await createSupabaseStaffStore(client).getFlags(null);
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }
  const byKey = new Map(flags.map((f) => [f.key, f.enabled]));
  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        tone="super"
        kicker="Features"
        title="ফিচারের ডিফল্ট"
        desc="নতুন ও সব কোর্সের জন্য ডিফল্ট। কোনো কোর্সের অ্যাডমিন নিজের কোর্সে আলাদা করে চালু/বন্ধ করলে সেটাই ঐ কোর্সে চলবে। বিজ্ঞাপন এখানে নেই, Ads পেজে।"
      />
      <Panel title="ফিচার">
        <FeatureSwitches
          features={FEATURES.map((f) => ({ ...f, enabled: byKey.get(f.key) ?? false }))}
          scopeNote="এখানে বদলালে সব কোর্সের ডিফল্ট বদলাবে।"
        />
      </Panel>
    </div>
  );
}
