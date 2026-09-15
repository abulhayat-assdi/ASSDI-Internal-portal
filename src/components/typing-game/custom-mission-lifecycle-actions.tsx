"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Send } from "lucide-react";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import { Alert, Button } from "@/components/typing-game/ui";
import type { CustomMissionStatus } from "@/lib/typing-game/server/custom-mission-store";

async function post(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Teacher activate/archive lifecycle buttons for a custom mission — only the
 * action valid for the current status renders. Not to be confused with
 * custom-mission-actions.tsx (student start-mission button).
 */
export function CustomMissionLifecycleActions({
  locale,
  missionId,
  status,
}: {
  locale: Locale;
  missionId: string;
  status: CustomMissionStatus;
}) {
  const t = getTranslator(locale, "missions");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function run(action: "activate" | "archive"): Promise<void> {
    setBusy(true);
    setError(false);
    const ok = await post(`/api/typing-game/teacher/custom-missions/${missionId}/${action}`);
    setBusy(false);
    if (!ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  if (status === "archived") return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <Button
            icon={<Send className="h-4 w-4" aria-hidden="true" />}
            loading={busy}
            onClick={() => { void run("activate"); }}
          >
            {t("activateMission")}
          </Button>
        ) : null}
        {status === "active" ? (
          <Button
            variant="danger"
            icon={<Archive className="h-4 w-4" aria-hidden="true" />}
            loading={busy}
            onClick={() => { void run("archive"); }}
          >
            {t("archiveMission")}
          </Button>
        ) : null}
      </div>
      {error ? <Alert tone="danger">{t("actionFailed")}</Alert> : null}
    </div>
  );
}
