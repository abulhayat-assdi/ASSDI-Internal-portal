import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import { LogoutButton } from "@/components/typing-game/logout-button";

/**
 * Calm, informational landing for accounts that cannot enter the student
 * area (message only, no data). Rendered inline by the student layout — it
 * must never redirect, or the gate would loop against itself.
 *
 * `reason` separates the two causes: "suspended" (an account an admin turned
 * off) from "provisioning" (no actor row — a system problem, not the
 * student's fault).
 */
export function SuspendedNotice({
  locale,
  reason = "suspended",
}: {
  locale: Locale;
  reason?: "suspended" | "provisioning";
}) {
  const t = getTranslator(locale, "auth");
  const title =
    reason === "provisioning" ? t("accountSetupFailed") : t("accountSuspended");
  const body =
    reason === "provisioning"
      ? t("accountSetupFailedBody")
      : t("accountInactive");
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
            <h1 className="text-lg font-bold">{title}</h1>
            <p className="text-sm text-ink-muted">{body}</p>
            <LogoutButton locale={locale} redirectTo="/student-login" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
