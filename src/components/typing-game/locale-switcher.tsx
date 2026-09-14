import Link from "next/link";
import { LOCALES, getTranslator, type Locale } from "@/lib/typing-game/i18n";

/** Locale switcher — links to the sibling locale home, fully translated. */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const t = getTranslator(current, "common");
  const a11y = getTranslator(current, "a11y");
  const names: Record<Locale, string> = {
    en: t("languageEnglish"),
    bn: t("languageBangla"),
  };
  return (
    <nav aria-label={a11y("languageMenu")} className="flex gap-4 text-sm">
      {LOCALES.filter((l) => l !== current).map((locale) => (
        <Link key={locale} className="tap-link-btn" href={`/student-dashboard/typing-game`}>
          {names[locale]}
        </Link>
      ))}
    </nav>
  );
}
