import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { createAdsStore } from "@/lib/typing-game/server/ads-store";
import { FEATURES } from "@/lib/typing-game/features";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { ConsoleHero, Panel } from "@/components/typing-game/staff/blocks";
import { FeatureSwitches } from "@/components/typing-game/staff/feature-switches";

export const dynamic = "force-dynamic";

/**
 * Student features for this admin's course (an org override); a super admin
 * here edits the platform default. Ads are not a feature switch: only the
 * super admin turns them on or off, for the whole system.
 */
export default async function AdminFlagsPage() {
  const locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let flags: { key: string; enabled: boolean }[] = [];
  let global = false;
  try {
    const { orgIds } = await requireAdmin(client);
    global = orgIds === null;
    flags = await createSupabaseStaffStore(client).getFlags(global ? null : (orgIds?.[0] ?? null));
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }
  const ads = await createAdsStore(client).settings();
  const byKey = new Map(flags.map((f) => [f.key, f.enabled]));

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        kicker="Features"
        title="স্টুডেন্টরা কী কী পাবে"
        desc="কোনো ফিচার বন্ধ করলে স্টুডেন্টদের মেনু থেকে সেটা সরে যায় আর ঐ পেজ খোলা যায় না। লেসন, প্র্যাকটিস, টেস্ট আর লিডারবোর্ড সবসময় চালু থাকে।"
      />
      <Panel title="ফিচার">
        <FeatureSwitches
          features={FEATURES.map((f) => ({ ...f, enabled: byKey.get(f.key) ?? false }))}
          scopeNote={global ? "আপনি Super Admin: এখানে বদলালে সব কোর্সের ডিফল্ট বদলাবে (যে কোর্স নিজে আলাদা করে রেখেছে, সেটা ছাড়া)।" : "শুধু আপনার কোর্সের স্টুডেন্টদের জন্য বদলাবে।"}
        />
      </Panel>
      <Panel title="বিজ্ঞাপন (Ads)" desc="পুরো সিস্টেমের জন্য শুধু Super Admin চালু বা বন্ধ করেন, এখান থেকে বদলানো যায় না।">
        <p className="flex items-center gap-2 text-sm">
          এখন: <span className={`tap-badge ${ads.enabled ? "tap-badge-warning" : "tap-badge-neutral"}`}>{ads.enabled ? "চালু" : "বন্ধ"}</span>
          {ads.enabled ? null : <span className="text-ink-muted">অ্যাড বন্ধ থাকলে “অ্যাড দেখে আনলক” করলে সরাসরি আনলক হয়ে যায়।</span>}
        </p>
      </Panel>
    </div>
  );
}
