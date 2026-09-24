"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/**
 * Idempotent logout button (server clears httpOnly cookies).
 *
 * `redirectTo` defaults to the staff login; student surfaces pass
 * "/student-login", which is where students actually sign in.
 */
export function LogoutButton({
  locale,
  redirectTo = "/login",
}: {
  locale: Locale;
  redirectTo?: string;
}) {
  const router = useRouter();
  const t = getTranslator(locale, "auth");
  const [busy, setBusy] = useState(false);

  async function logout(): Promise<void> {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "DELETE" });
    } catch {
      /* logout never strands the UI */
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      type="button"
      className="tap-btn tap-btn-secondary tap-btn-sm"
      disabled={busy}
      onClick={() => void logout()}
    >
      {t("logout")}
    </button>
  );
}
