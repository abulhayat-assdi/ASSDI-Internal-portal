import { PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { MissionForm } from "@/components/typing-game/mission-form";

/** Admin mission creation (configuration form, not a visual editor). */
export default function AdminMissionNewPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "missions");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("createTitle")} />
      <MissionForm locale={locale} />
    </div>
  );
}
