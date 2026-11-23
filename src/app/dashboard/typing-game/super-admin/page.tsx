import Link from "next/link";
import { Building2, Clock3, Flame, Megaphone, Users } from "lucide-react";
import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { requireSuperAdmin } from "@/lib/typing-game/server/staff";
import { createSupabaseStaffStore } from "@/lib/typing-game/server/staff-store";
import { getAdminOverview } from "@/lib/typing-game/server/staff-data";
import { loadInsights } from "@/lib/typing-game/server/insights";
import { createAdsStore } from "@/lib/typing-game/server/ads-store";
import { FEATURES } from "@/lib/typing-game/features";
import { ForbiddenBlock } from "@/components/typing-game/forbidden-block";
import { ActivityChart } from "@/components/typing-game/staff/activity-chart";
import { AuditFeed, BatchHealth, ConsoleHero, HeroLink, Kpi, Panel, PanelLink } from "@/components/typing-game/staff/blocks";

export const dynamic = "force-dynamic";

const BASE = "/dashboard/typing-game/super-admin";

export default async function SuperAdminPage() {
  const locale = DEFAULT_LOCALE;
  const session = await getSession();
  const client = session ? await userDbClient() : null;
  if (!session || !client) return <ForbiddenBlock locale={locale} />;
  let overview;
  try {
    await requireSuperAdmin(client);
    overview = await getAdminOverview(null, createSupabaseStaffStore(client));
  } catch {
    return <ForbiddenBlock locale={locale} />;
  }
  const [ins, ads] = await Promise.all([loadInsights(client), createAdsStore(client).settings()]);
  const t = ins.totals;
  const flags = new Map(overview.flags.map((f) => [f.key, f.enabled]));
  const adsMode = !ads.enabled ? "Off" : ads.provider === "google" ? "Google" : "Test (mock)";

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHero
        tone="super"
        kicker="Platform"
        title="Super Admin"
        desc={`${overview.orgs.length}টা কোর্সে ${t.students} জন স্টুডেন্ট। আজ ${t.activeToday} জন ${t.minutesToday} মিনিট টাইপ করেছে।`}
      >
        <HeroLink href={`${BASE}/ads`}>
          <Megaphone className="h-4 w-4" aria-hidden="true" /> Ads settings
        </HeroLink>
      </ConsoleHero>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Building2} label="Courses" value={overview.orgs.length} hint={`${t.activeBatches}/${t.batches} batches active`} tone="amber" />
        <Kpi icon={Users} label="Students" value={t.students} hint={`${t.neverStarted} not started`} tone="indigo" />
        <Kpi icon={Flame} label="Active (7 days)" value={t.active7d} hint={`${t.activeToday} today`} tone="rose" />
        <Kpi icon={Clock3} label="Typing minutes (7d)" value={t.minutes7d} hint={`${t.lessons7d} lessons · ${t.games7d} games`} tone="sky" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Ads (whole system)"
          desc="অ্যাড চালু/বন্ধ শুধু আপনি করতে পারেন। কোনো কোর্সের অ্যাডমিন এটা বদলাতে পারেন না।"
          action={<PanelLink href={`${BASE}/ads`}>Change</PanelLink>}
        >
          <div className="flex items-center gap-3">
            <span className={`sc-kpi-icon ${ads.enabled ? "sc-tone-amber" : "sc-tone-indigo"}`}>
              <Megaphone className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-xl font-extrabold">{adsMode}</p>
              <p className="text-xs text-ink-muted">
                {ads.enabled
                  ? `Display ${ads.displayEnabled ? "on" : "off"} · Rewarded ${ads.rewardedEnabled ? "on" : "off"}`
                  : "স্টুডেন্টরা কোনো অ্যাড দেখে না; “অ্যাড দেখে আনলক” সরাসরি আনলক করে।"}
              </p>
            </div>
          </div>
        </Panel>
        <Panel title="Feature defaults" action={<PanelLink href={`${BASE}/flags`}>Change</PanelLink>}>
          <ul className="flex flex-col gap-1.5">
            {FEATURES.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-2 text-sm">
                <span>{f.title}</span>
                <span className={`tap-badge ${flags.get(f.key) ? "tap-badge-success" : "tap-badge-neutral"}`}>{flags.get(f.key) ? "On" : "Off"}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Recent changes" action={<PanelLink href={`${BASE}/audit`}>All</PanelLink>}>
          <AuditFeed entries={overview.recentAudit.slice(0, 5)} />
        </Panel>
      </div>

      <Panel title="Daily typing" desc="সব কোর্স মিলে, গত ১৪ দিন">
        <ActivityChart days={ins.days} />
      </Panel>

      <Panel title="সব ব্যাচ" desc="সব কোর্সের ব্যাচের সাপ্তাহিক অবস্থা" action={<PanelLink href="/dashboard/typing-game/admin/batches">Admin console-এ ম্যানেজ করুন</PanelLink>}>
        <BatchHealth batches={ins.batches} hrefFor={(id) => `/dashboard/typing-game/admin/students?batch=${id}`} />
      </Panel>
      <p className="text-center text-xs text-ink-faint">
        Courses: {overview.orgs.map((o) => o.name).join(", ") || "—"} ·{" "}
        <Link href="/dashboard/typing-game/admin/analytics" className="underline">
          Analytics
        </Link>
      </p>
    </div>
  );
}
