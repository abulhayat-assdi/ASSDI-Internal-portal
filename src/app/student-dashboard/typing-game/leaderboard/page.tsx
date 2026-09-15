import { Alert, Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import {
  BoardAccessError,
  getBatchLeaderboard,
} from "@/lib/typing-game/server/student";
import { LeaderboardTable } from "@/components/typing-game/leaderboard-table";

const WINDOWS = ["today", "week", "month", "all"] as const;

/** Batch board. The fn enforces membership — a forged batch param 403s here. */
export default async function LeaderboardPage(
  props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ window?: string; batch?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "leaderboard");
  const { session, store } = await studentContext(locale);

  const window = WINDOWS.includes(searchParams.window as never)
    ? (searchParams.window as (typeof WINDOWS)[number])
    : "all";

  try {
    const board = await getBatchLeaderboard(session.userId, store, {
      batchId: searchParams.batch,
      window,
    });
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <Card>
          <CardContent>
            <LeaderboardTable
              locale={locale}
              rows={board.rows}
              userId={session.userId}
              window={board.window}
              batchId={board.batchId}
            />
          </CardContent>
        </Card>
      </div>
    );
  } catch (err) {
    if (err instanceof BoardAccessError) {
      return (
        <Alert tone="warning" title={t("title")}>
          {t("raiseError")}
        </Alert>
      );
    }
    throw err;
  }
}
