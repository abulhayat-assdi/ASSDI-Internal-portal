import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { requireAdmin } from "@/lib/typing-game/server/staff";
import { loadInsights } from "@/lib/typing-game/server/insights";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { ConsoleHero } from "@/components/typing-game/staff/blocks";
import { AnalyticsView } from "@/components/typing-game/staff/analytics-view";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  try {
    await requireAdmin(client);
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }
  const ins = await loadInsights(client);
  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        kicker="Analytics"
        title="Learning Progress"
        desc="স্টুডেন্টরা কোর্সের কোথায় আছে, কত দ্রুত টাইপ করছে আর কোন গেম বেশি খেলছে। কোন লেভেলে সবাই আটকে যাচ্ছে, সেটা দেখে ক্লাসে জোর দিন।"
      />
      <AnalyticsView ins={ins} />
    </div>
  );
}
