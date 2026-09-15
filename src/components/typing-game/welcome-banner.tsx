import Link from "next/link";
import { PartyPopper, Play, Sparkle, Unlock } from "lucide-react";
import { Alert } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/** First-session guide: three steps into the recommended game. */
export function WelcomeBanner({
  locale,
  gameHref,
}: {
  locale: Locale;
  gameHref: string;
}) {
  const t = getTranslator(locale, "onboarding");
  const steps: Array<{ icon: typeof Play; label: string }> = [
    { icon: Play, label: t("stepPlay") },
    { icon: Sparkle, label: t("stepResult") },
    { icon: Unlock, label: t("stepUnlock") },
  ];
  return (
    <Alert
      tone="info"
      className="tap-welcome-banner"
      title={
        <span className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5" aria-hidden="true" /> {t("welcome")}
        </span>
      }
    >
      <p className="mb-3">{t("intro")}</p>
      <ol className="mb-4 flex flex-col gap-1.5 sm:flex-row sm:gap-3">
        {steps.map(({ icon: Icon, label }, i) => (
          <li key={label} className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="tap-chip">
              {i + 1}. <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            {label}
          </li>
        ))}
      </ol>
      <Link href={gameHref} className="tap-btn tap-btn-primary tap-btn-md">
        <Play className="h-4 w-4" fill="currentColor" /> {t("startNow")}
      </Link>
    </Alert>
  );
}
