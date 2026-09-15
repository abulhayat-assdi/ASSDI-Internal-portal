import { notFound } from "next/navigation";
import { Badge, Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { warPageContext } from "@/lib/typing-game/server/war-pages";
import { WarBoard } from "@/components/typing-game/war-board";
import { WarActions } from "@/components/typing-game/war-actions";

/** Admin war oversight: board, participants, cancel/finalize/advance. */
export default async function AdminWarDetailPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "wars");
  const { store } = await warPageContext(locale);
  const war = await store.getWar(params.id);
  if (!war) notFound();
  const board = await store.getBoard(war.id);

  const actions: ("cancel" | "advance" | "sync" | "finalize")[] = [];
  if (war.status !== "finalized") actions.push("sync");
  if (
    war.status === "accepted" ||
    war.status === "preparation" ||
    war.status === "live"
  ) {
    actions.push("advance");
  }
  if (war.status === "processing") actions.push("finalize");
  if (
    war.status !== "finalized" &&
    war.status !== "processing" &&
    war.status !== "live"
  ) {
    actions.push("cancel");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("versus", {
          a: war.challengerName || "—",
          b: war.defenderName || "—",
        })}
        description={
          <Badge tone={war.status === "live" ? "success" : "neutral"}>
            {war.status}
          </Badge>
        }
      />
      {actions.length > 0 ? (
        <Card>
          <CardContent>
            <WarActions locale={locale} warId={war.id} actions={actions} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent>
          <WarBoard locale={locale} rows={board} />
        </CardContent>
      </Card>
    </div>
  );
}
