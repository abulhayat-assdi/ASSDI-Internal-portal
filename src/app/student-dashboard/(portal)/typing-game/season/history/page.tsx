import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { seasonPageContext } from "@/lib/typing-game/server/season-pages";
import { seasonStatusKey, seasonStatusTone } from "@/components/typing-game/season-board";

/** Season history: every visible season with its final status. */
export default async function SeasonHistoryPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "seasons");
  const { store } = await seasonPageContext(locale);
  const seasons = await store.listSeasons();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("sectionHistory")} description={t("hubSubtitle")} />
      {seasons.length === 0 ? (
        <EmptyState title={t("sectionHistory")} description={t("emptyBoard")} />
      ) : (
        <div className="flex flex-col gap-3">
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={`/student-dashboard/typing-game/season/${s.id}`}
              className="tap-card tap-card-interactive flex items-center justify-between gap-3 px-5 py-4"
            >
              <div>
                <p className="tap-card-title">{s.name}</p>
                <p className="tap-card-desc">{s.theme}</p>
              </div>
              <Badge tone={seasonStatusTone(s.status)}>{t(seasonStatusKey(s.status))}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
