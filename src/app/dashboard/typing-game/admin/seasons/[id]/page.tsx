import { notFound } from "next/navigation";
import { Badge, Card, CardContent, PageHeader, SectionHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { seasonPageContext } from "@/lib/typing-game/server/season-pages";
import { SeasonAdminActions } from "@/components/typing-game/season-admin-actions";
import { SeasonBoard } from "@/components/typing-game/season-board";

/** Admin season management: lifecycle, sources, tiers, boards. */
export default async function AdminSeasonManagePage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "seasons");
  const { store } = await seasonPageContext(locale);
  const seasons = await store.listSeasons();
  const row = seasons.find((s) => s.id === params.id);
  if (!row) notFound();
  const [student, clan] = await Promise.all([
    store.getBoard(row.id, "student"),
    store.getBoard(row.id, "clan"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={row.name}
        description={
          <>
            {row.slug}{" "}
            <Badge tone={row.status === "active" ? "success" : "neutral"}>
              {row.status}
            </Badge>
          </>
        }
      />
      <Card>
        <CardContent>
          <SeasonAdminActions
            locale={locale}
            seasonId={row.id}
            status={row.status}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SectionHeader title={t("sectionStudentBoard")} />
          <SeasonBoard locale={locale} rows={student} clan={false} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SectionHeader title={t("sectionClanBoard")} />
          <SeasonBoard locale={locale} rows={clan} clan={true} />
        </CardContent>
      </Card>
    </div>
  );
}
