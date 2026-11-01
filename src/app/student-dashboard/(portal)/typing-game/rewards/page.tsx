import { Gift } from "lucide-react";
import { Badge, Card, CardContent, EmptyState, PageHeader, SectionHeader, type BadgeTone } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { rewardedPageContext } from "@/lib/typing-game/server/rewarded-pages";
import { RewardOptIn } from "@/components/typing-game/reward-opt-in";

const SESSION_STATUS_TONE: Record<string, BadgeTone> = {
  offered: "neutral",
  opted_in: "primary",
  started: "primary",
  completed: "warning",
  verified: "warning",
  rewarded: "success",
  failed: "danger",
  expired: "neutral",
  cancelled: "neutral",
};

/** Optional rewards: catalog offers, each honestly labeled. */
export default async function RewardsPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "rewards");
  const { store } = await rewardedPageContext(locale);
  const [rewards, policy, sessions] = await Promise.all([
    store.rewardCatalog().catch(() => []),
    store.policy().catch(() => null),
    store.mySessions().catch(() => []),
  ]);
  const active = rewards.filter((r) => r.enabled);
  const provider = policy?.provider ?? "mock";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("rewardsTitle")}
        description={t("rewardsSubtitle")}
      />
      {active.length === 0 ? (
        <EmptyState
          title={t("rewardsTitle")}
          description={t("noOpportunities")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((r) => (
            <Card key={r.slug}>
              <CardContent>
                <RewardOptIn
                  locale={locale}
                  rewardSlug={r.slug}
                  rewardLabel={`${r.ref} ×${String(r.amount)}`}
                  placement="rewards_page"
                  provider={provider}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {sessions.length > 0 ? (
        <Card>
          <CardContent>
            <SectionHeader
              title={
                <span className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary-500" aria-hidden="true" />
                  {t("rewardsTitle")}
                </span>
              }
            />
            <ul className="flex flex-col gap-2 text-sm">
              {sessions.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">{s.rewardSlug}</span>
                  <Badge tone={SESSION_STATUS_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
