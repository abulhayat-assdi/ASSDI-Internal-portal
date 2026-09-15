"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/**
 * Start-mission button: POSTs to the custom-mission start-attempt endpoint,
 * then navigates to the play route with the freshly minted attemptId (the
 * endpoint mints a new attempt every call, so this can't be a plain <Link>).
 */
export function StartCustomMissionButton({
  locale,
  missionId,
  label,
}: {
  locale: Locale;
  missionId: string;
  label?: string;
}) {
  const t = getTranslator(locale, "missions");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/typing-game/custom-missions/${encodeURIComponent(missionId)}/attempts/start`,
        { method: "POST" },
      );
      if (res.status === 409) {
        // ALREADY_COMPLETED (terminal mission) — refresh so the page swaps
        // to the completed state instead of a dead-end error.
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error(`start failed: ${String(res.status)}`);
      const body = (await res.json()) as { attemptId?: string };
      if (!body.attemptId) throw new Error("MISSING_ATTEMPT_ID");
      router.push(
        `/student-dashboard/typing-game/missions/${encodeURIComponent(missionId)}/play/${encodeURIComponent(body.attemptId)}`,
      );
    } catch {
      setError(t("actionFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="tap-btn tap-btn-primary tap-btn-lg"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => {
          void start();
        }}
      >
        {busy ? <span className="tap-spinner" aria-hidden="true" /> : null}
        {label ?? t("startMission")}
      </button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
