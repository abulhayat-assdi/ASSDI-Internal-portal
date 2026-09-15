import { Card, CardContent, EmptyState, PageHeader, SectionHeader, StatCard } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { adaptivePageContext } from "@/lib/typing-game/server/adaptive-pages";

/** Admin learning analytics: funnel, completion, global trends. */
export default async function AdminAdaptivePage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "adaptive");
  const { store } = await adaptivePageContext(locale);
  let summary: Record<string, unknown> = {};
  try {
    summary = await store.globalSummary();
  } catch {
    summary = {};
  }

  const funnel =
    typeof summary.funnel === "object" && summary.funnel !== null
      ? (summary.funnel as Record<string, unknown>)
      : null;
  const games = Array.isArray(summary.game_completion)
    ? summary.game_completion.filter(
        (x): x is Record<string, unknown> =>
          typeof x === "object" && x !== null,
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("manageTitle")} description={t("globalTitle")} />
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label={t("funnelShown")}
          value={typeof funnel?.shown === "number" ? funnel.shown : "—"}
        />
        <StatCard
          label={t("funnelStarted")}
          value={typeof funnel?.started === "number" ? funnel.started : "—"}
        />
        <StatCard
          label={t("funnelCompleted")}
          value={typeof funnel?.completed === "number" ? funnel.completed : "—"}
        />
      </div>
      <Card>
        <CardContent>
          <SectionHeader title={t("gameCompletion")} />
          {games.length === 0 ? (
            <EmptyState title={t("gameCompletion")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="tap-table">
                <thead>
                  <tr>
                    <th scope="col">{t("gameCompletion")}</th>
                    <th scope="col">{t("funnelCompleted")}</th>
                  </tr>
                </thead>
                <tbody>
                  {games.slice(0, 10).map((g, i) => (
                    <tr key={typeof g.game_slug === "string" ? g.game_slug : i}>
                      <th scope="row" className="font-mono text-xs">
                        {typeof g.game_slug === "string" ? g.game_slug : "game"}
                      </th>
                      <td>
                        {typeof g.completion === "number"
                          ? Math.round(g.completion * 10) / 10
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
