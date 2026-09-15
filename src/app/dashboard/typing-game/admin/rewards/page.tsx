import { Badge, Card, CardContent, EmptyState, PageHeader, SectionHeader, StatCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { rewardedPageContext } from "@/lib/typing-game/server/rewarded-pages";
import { RewardAdminControls } from "@/components/typing-game/reward-admin-controls";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Admin rewarded-ads console: policy, definitions, funnel. */
export default async function AdminRewardsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "rewards");
  const { store } = await rewardedPageContext(locale);
  const policy = await store.policy().catch(() => null);
  const funnel: Record<string, unknown> = await store
    .funnel()
    .catch(() => ({}));
  const rewards = await store.rewardCatalog().catch(() => []);
  const events = isRecord(funnel.events)
    ? Object.entries(funnel.events)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("manageTitle")} />
      <Card>
        <CardContent>
          <RewardAdminControls
            locale={locale}
            policy={{
              enabled: policy?.enabled ?? false,
              provider: policy?.provider ?? "mock",
              dailyLimit: policy?.dailyLimit ?? 5,
              cooldownMinutes: policy?.cooldownMinutes ?? 60,
              maxRewardsPerDay: policy?.maxRewardsPerDay ?? 5,
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SectionHeader title={t("funnelTitle")} />
          {events.length === 0 ? (
            <EmptyState title={t("funnelTitle")} description={t("noFill")} />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {events.map(([k, v]) => (
                <StatCard key={k} label={k} value={typeof v === "number" ? v : "—"} />
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {rewards.map((r) => (
              <Badge key={r.slug} tone={r.enabled ? "success" : "neutral"}>
                {r.slug}:{r.enabled ? "on" : "off"}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
