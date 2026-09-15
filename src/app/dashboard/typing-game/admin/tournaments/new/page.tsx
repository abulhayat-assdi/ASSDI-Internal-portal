import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { TournamentForm } from "@/components/typing-game/tournament-form";

/** Admin tournament creation (configuration form, not a visual editor). */
export default function AdminTournamentNewPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "tournaments");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("createTitle")} />
      <Card>
        <CardContent>
          <TournamentForm locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
