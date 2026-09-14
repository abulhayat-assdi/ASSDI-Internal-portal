import { PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { BossForm } from "@/components/typing-game/boss-form";

/** Admin boss creation (configuration form, not a visual editor). */
export default function AdminBossNewPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "bosses");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("createTitle")} />
      <BossForm locale={locale} />
    </div>
  );
}
