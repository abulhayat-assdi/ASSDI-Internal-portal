"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Swords } from "lucide-react";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/** Strike button: bind one validated attempt as boss damage. */
export function BossStrikeButton({
  locale,
  instanceId,
  attemptId,
}: {
  locale: Locale;
  instanceId: string;
  attemptId: string | null;
}) {
  const t = getTranslator(locale, "bosses");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [damage, setDamage] = useState<number | null>(null);

  async function strike(): Promise<void> {
    if (!attemptId) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/typing-game/bosses/${encodeURIComponent(instanceId)}/submit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attemptId }),
        },
      );
      if (!res.ok) throw new Error(`strike failed: ${String(res.status)}`);
      const data = (await res.json()) as { damage?: unknown };
      setDamage(typeof data.damage === "number" ? data.damage : null);
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        className="tap-btn tap-btn-primary tap-btn-lg tap-btn-strike"
        disabled={busy || !attemptId}
        aria-busy={busy || undefined}
        onClick={() => {
          void strike();
        }}
      >
        <Swords className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        {t("submitLatest")}
      </button>
      <AnimatePresence mode="popLayout">
        {damage !== null ? (
          <motion.p
            key={damage}
            role="status"
            initial={{ opacity: 0, y: 10, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 16 }}
            className="tap-boss-damage"
          >
            +{damage}
          </motion.p>
        ) : null}
      </AnimatePresence>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {t("actionFailed")}
        </p>
      ) : null}
    </div>
  );
}
