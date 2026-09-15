import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { LogoutButton } from "@/components/typing-game/logout-button";

/** Calm, informational landing for non-active accounts (message only, no data). */
export default function SuspendedPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "auth");
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center gap-4 p-6">
      <Card>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--tap-surface-strong)", color: "var(--tap-primary-500)" }}
              aria-hidden="true"
            >
              <Info className="h-7 w-7" />
            </span>
            <h1 className="text-lg font-bold">{t("accountSuspended")}</h1>
            <p className="text-sm text-ink-muted">{t("accountInactive")}</p>
            <LogoutButton locale={locale} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
