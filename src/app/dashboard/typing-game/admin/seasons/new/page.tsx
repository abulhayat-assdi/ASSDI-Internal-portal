import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { SeasonForm } from "@/components/typing-game/season-form";

/** Admin season creation (configuration form, not a visual editor). */
export default function AdminSeasonNewPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "seasons");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("createTitle")} />
      <Card>
        <CardContent>
          <SeasonForm locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
